declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): any[][];
    export(): Uint8Array;
    each(sql: string, params: any[], callback: (row: any) => void): void;
    prepare(sql: string): Statement;
  }

  export interface Statement {
    bind(params: any[]): void;
    step(): boolean;
    free(): void;
    reset(): void;
  }

  export function Database(options?: any): Database;

  export default function Database(options?: any): Database;
}