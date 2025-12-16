declare module 'sql.js' {
    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number>) => Database;
    }

    interface Database {
        run(sql: string, params?: any[]): void;
        exec(sql: string): QueryExecResult[];
        export(): Uint8Array;
        close(): void;
    }

    interface QueryExecResult {
        columns: string[];
        values: any[][];
    }

    interface SqlJsConfig {
        locateFile?: (file: string) => string;
    }

    function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;

    export default initSqlJs;
}
