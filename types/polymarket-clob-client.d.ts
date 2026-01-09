// Type declarations for @polymarket/clob-client
// This package uses ethers v5 types but our project uses ethers v6
// We need to override the types to make them compatible

import type { Wallet as EthersV6Wallet } from 'ethers';

declare module '@polymarket/clob-client' {
    // Re-export everything from the actual package
    export * from '@polymarket/clob-client/dist/types';
    export * from '@polymarket/clob-client/dist/config';

    // Override ClobClient to accept ethers v6 Wallet
    export class ClobClient {
        constructor(
            host: string,
            chainId: number,
            signer?: any, // Accept any wallet type to bypass v5/v6 mismatch
            creds?: any,
            signatureType?: any,
            funderAddress?: string,
            geoBlockToken?: string,
            useServerTime?: boolean,
            builderConfig?: any,
            getSigner?: () => Promise<any> | any,
            retryOnError?: boolean
        );

        getTrades(params?: any, only_first_page?: boolean, next_cursor?: string): Promise<any[]>;
        getMarket(conditionID: string): Promise<any>;
        // Add other methods as needed - TypeScript will infer them from the actual implementation
        [key: string]: any;
    }
}
