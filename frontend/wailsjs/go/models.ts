export namespace main {
	
	export class NetStats {
	    downloadSpeed: string;
	    uploadSpeed: string;
	    downloadUnit: string;
	    uploadUnit: string;
	    totalRecv: string;
	    totalSent: string;
	    ping: string;
	    connections: number;
	
	    static createFrom(source: any = {}) {
	        return new NetStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.downloadSpeed = source["downloadSpeed"];
	        this.uploadSpeed = source["uploadSpeed"];
	        this.downloadUnit = source["downloadUnit"];
	        this.uploadUnit = source["uploadUnit"];
	        this.totalRecv = source["totalRecv"];
	        this.totalSent = source["totalSent"];
	        this.ping = source["ping"];
	        this.connections = source["connections"];
	    }
	}

}

