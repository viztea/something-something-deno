/**
 * Represents a network address.
 */
export interface Address {
    readonly ip: string;

    readonly port: number;
}

/**
 * Formats the supplied {@link address} into a string.
 * 
 * @param address the address to format.
 * @returns the formatted address.
 */
export function formatAddress(address: Address): string {
    return `${address.ip}:${address.port}`;
}
