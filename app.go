package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	goruntime "runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"

	psnet "github.com/shirou/gopsutil/v3/net"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows/registry"
)

type App struct {
	ctx         context.Context
	lastRecv    uint64
	lastSent    uint64
	lastTime    time.Time
	sessionRecv uint64
	sessionSent uint64
}

func NewApp() *App {
	return &App{}
}

func ensureSingleInstance() bool {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	createMutex := kernel32.NewProc("CreateMutexW")
	name, _ := syscall.UTF16PtrFromString("NetTrackerSingleInstance")
	handle, _, err := createMutex.Call(0, 1, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return false
	}
	if err.(syscall.Errno) == 183 {
		return false
	}
	return true
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go func() {
		time.Sleep(500 * time.Millisecond)
		hideFromTaskbar()
	}()
	go func() {
		for {
			time.Sleep(1 * time.Second)
			forceTopmost()
		}
	}()
	counters, err := psnet.IOCounters(false)
	if err == nil && len(counters) > 0 {
		a.lastRecv = counters[0].BytesRecv
		a.lastSent = counters[0].BytesSent
	}
	a.lastTime = time.Now()
	a.sessionRecv = 0
	a.sessionSent = 0
}

func hideFromTaskbar() {
	user32 := syscall.NewLazyDLL("user32.dll")
	enumWindows := user32.NewProc("EnumWindows")
	getWindowThreadProcessId := user32.NewProc("GetWindowThreadProcessId")
	setWindowLongW := user32.NewProc("SetWindowLongW")
	getWindowLongW := user32.NewProc("GetWindowLongW")
	setWindowPos := user32.NewProc("SetWindowPos")
	pid := uint32(os.Getpid())
	cb := syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
		var windowPid uint32
		getWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&windowPid)))
		if windowPid == pid {
			GWL_EXSTYLE      := uintptr(0xFFFFFFEC)
			GWL_STYLE        := uintptr(0xFFFFFFF0)
			WS_EX_TOOLWINDOW := uintptr(0x00000080)
			WS_EX_APPWINDOW  := uintptr(0x00040000)
			WS_SYSMENU       := uintptr(0x00080000)
			HWND_TOPMOST     := uintptr(0xFFFFFFFF)
			SWP_FLAGS        := uintptr(0x0012)
			style, _, _ := getWindowLongW.Call(hwnd, GWL_EXSTYLE)
			style = (style &^ WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW
			setWindowLongW.Call(hwnd, GWL_EXSTYLE, style)
			style2, _, _ := getWindowLongW.Call(hwnd, GWL_STYLE)
			style2 = style2 &^ WS_SYSMENU
			setWindowLongW.Call(hwnd, GWL_STYLE, style2)
			setWindowPos.Call(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_FLAGS)
		}
		return 1
	})
	enumWindows.Call(cb, 0)
}

func forceTopmost() {
	user32 := syscall.NewLazyDLL("user32.dll")
	enumWindows := user32.NewProc("EnumWindows")
	getWindowThreadProcessId := user32.NewProc("GetWindowThreadProcessId")
	setWindowPos := user32.NewProc("SetWindowPos")
	pid := uint32(os.Getpid())
	cb := syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
		var windowPid uint32
		getWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&windowPid)))
		if windowPid == pid {
			HWND_TOPMOST := uintptr(0xFFFFFFFF)
			SWP_FLAGS    := uintptr(0x0012)
			setWindowPos.Call(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_FLAGS)
		}
		return 1
	})
	enumWindows.Call(cb, 0)
}

func (a *App) OpenSettings() {
	wailsruntime.WindowSetSize(a.ctx, 300, 420)
}

func (a *App) CloseSettings(barWidth int) {
	wailsruntime.WindowSetSize(a.ctx, barWidth, 36)
}

func (a *App) SetStartup(enable bool) bool {
	key, err := registry.OpenKey(registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Run`,
		registry.SET_VALUE)
	if err != nil {
		return false
	}
	defer key.Close()
	if enable {
		exe, err := os.Executable()
		if err != nil {
			return false
		}
		key.SetStringValue("NetTracker", exe)
	} else {
		key.DeleteValue("NetTracker")
	}
	return true
}

func (a *App) GetStartup() bool {
	key, err := registry.OpenKey(registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Run`,
		registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer key.Close()
	_, _, err = key.GetStringValue("NetTracker")
	return err == nil
}

type NetStats struct {
	DownloadSpeed string `json:"downloadSpeed"`
	UploadSpeed   string `json:"uploadSpeed"`
	DownloadUnit  string `json:"downloadUnit"`
	UploadUnit    string `json:"uploadUnit"`
	TotalRecv     string `json:"totalRecv"`
	TotalSent     string `json:"totalSent"`
	Ping          string `json:"ping"`
	Connections   int    `json:"connections"`
}

func formatSpeed(bytesPerSec float64) (string, string) {
	if bytesPerSec >= 1024*1024 {
		return fmt.Sprintf("%.1f", bytesPerSec/1024/1024), "MB/s"
	}
	return fmt.Sprintf("%.1f", bytesPerSec/1024), "KB/s"
}

func formatBytes(bytes uint64) string {
	if bytes >= 1024*1024*1024 {
		return fmt.Sprintf("%.2f GB", float64(bytes)/1024/1024/1024)
	} else if bytes >= 1024*1024 {
		return fmt.Sprintf("%.1f MB", float64(bytes)/1024/1024)
	}
	return fmt.Sprintf("%.0f KB", float64(bytes)/1024)
}

func (a *App) GetNetStats() NetStats {
	counters, err := psnet.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return NetStats{DownloadSpeed: "0", UploadSpeed: "0", DownloadUnit: "KB/s", UploadUnit: "KB/s"}
	}
	now := time.Now()
	elapsed := now.Sub(a.lastTime).Seconds()
	currentRecv := counters[0].BytesRecv
	currentSent := counters[0].BytesSent
	downSpeed := float64(currentRecv-a.lastRecv) / elapsed
	upSpeed := float64(currentSent-a.lastSent) / elapsed
	if downSpeed < 0 { downSpeed = 0 }
	if upSpeed < 0 { upSpeed = 0 }
	if currentRecv >= a.lastRecv {
		a.sessionRecv += currentRecv - a.lastRecv
	}
	if currentSent >= a.lastSent {
		a.sessionSent += currentSent - a.lastSent
	}
	a.lastRecv = currentRecv
	a.lastSent = currentSent
	a.lastTime = now
	downVal, downUnit := formatSpeed(downSpeed)
	upVal, upUnit := formatSpeed(upSpeed)
	conns, _ := psnet.Connections("all")
	return NetStats{
		DownloadSpeed: downVal,
		UploadSpeed:   upVal,
		DownloadUnit:  downUnit,
		UploadUnit:    upUnit,
		TotalRecv:     formatBytes(a.sessionRecv),
		TotalSent:     formatBytes(a.sessionSent),
		Ping:          a.GetPing(),
		Connections:   len(conns),
	}
}

func (a *App) GetPing() string {
	var cmd *exec.Cmd
	if goruntime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", "1000", "8.8.8.8")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000,
		}
	} else {
		cmd = exec.Command("ping", "-c", "1", "-W", "1", "8.8.8.8")
	}
	out, err := cmd.Output()
	if err != nil { return "—" }
	output := string(out)
	if goruntime.GOOS == "windows" {
		for _, line := range strings.Split(output, "\n") {
			if strings.Contains(line, "time=") || strings.Contains(line, "time<") {
				parts := strings.Split(line, "time")
				if len(parts) > 1 {
					t := strings.Trim(parts[1], "=<>ms \r\n")
					t = strings.Split(t, "ms")[0]
					t = strings.TrimSpace(t)
					if _, err := strconv.Atoi(t); err == nil {
						return t + "ms"
					}
				}
			}
		}
	}
	return "—"
}

func (a *App) GetLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil { return "unknown" }
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "unknown"
}