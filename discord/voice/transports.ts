import type { Address } from "./utils.ts";
import { readUInt16BE, writers } from "../../tools/mod.ts";
import { decoder } from "./deps.ts";

export type Datagram = [ Uint8Array, Deno.Addr ]

const k_memory = Symbol.for("VoiceTransport#memory");

const decode = decoder()
const defaultTranport = {
    get totalBytesRead() {
        return this[k_memory].read
    },
    get totalBytesWritten() {
        return this[k_memory].written
    },
} as VoiceTransport

interface VoiceTransportMemory {
    socket: Deno.DatagramConn;
    written: number;
    read: number;
}

/**
 * Represents a transport for voice data.
 */
export interface VoiceTransport {
    [k_memory]: VoiceTransportMemory;

    /**
     * The address this transport is connected to.
     */
    readonly address: Address;

    /**
     * The total number of bytes written to this transport.
     */
    get totalBytesWritten(): number;

    /**
     * The total number of bytes read from this transport.
     */
    get totalBytesRead(): number;
}

/**
 * Creates a new {@link VoiceTransport} with the supplied {@link ip} and {@link port}.
 * 
 * @param address The server address to send datagrams to.
 * @returns the new transport. 
 */
function create(address: Address): VoiceTransport {
    /* create udp socket. */
    const socket = Deno.listenDatagram({ transport: "udp", hostname: "0.0.0.0", port: 0 });

    /* create transport object. */
    return Object.assign(defaultTranport, {
        address,
        [k_memory]: { socket, written: 0, read: 0 },
    });
}

/**
 * Sends the supplied {@link data} to the transport.
 * 
 * @param transport the transport to send the data to.
 * @param data the data to send.
 * @returns the number of bytes written.
 */
async function send(transport: VoiceTransport, data: Uint8Array): Promise<number> {
    const written = await transport[k_memory].socket.send(
        data, 
        { hostname: transport.address.ip, port: transport.address.port, transport: "udp" }
    );

    transport[k_memory].written += written;
    return written
}

/**
 * Receives a datagram from the transport.
 * 
 * @param transport the transport to receive the datagram from.
 * @returns the datagram and the address it was received from.
 */
async function receive(transport: VoiceTransport): Promise<Datagram> {
    const datagram = await transport[k_memory].socket.receive();
    transport[k_memory].read = datagram[0].length

    return datagram;
}

/**
 * Creates a writable byte stream for the supplied {@link transport}.
 * 
 * @param transport The transport to create a writable stream for.
 * @returns the writable stream.
 */
function writable(transport: VoiceTransport): WritableStream<Uint8Array> {
    return new WritableStream({
        write: async (data: Uint8Array) => void await send(transport, data)
    });
}

/**
 * Creates a readable byte stream for the supplied {@link transport}.
 * 
 * @param transport The transport to create a readable stream for.
 * @returns the readable stream.
 */
function readable(transport: VoiceTransport): ReadableStream<Datagram> {
    return new ReadableStream({
        pull: async (controller) => controller.enqueue(await receive(transport))
    });
}

/**
 * Performs a holepunch on the supplied {@link transport} with the supplied {@link ssrc}.
 * 
 * @param transport the transport to use for the holepunch.
 * @param ssrc      the SSRC of the voice connection.
 * @returns the address of the holepunched connection.
 */

async function holepunch(transport: VoiceTransport, ssrc: number): Promise<Address> {
    const writer = writers.create(74);
    writers.writeUInt16(writer, 0x1);
    writers.writeUInt16(writer, 70);
    writers.writeUInt32(writer, ssrc);

    await send(transport, writer.data);

    const [resp] = await receive(transport);
    return {
        ip: decode(resp.slice(8, resp.indexOf(0, 8))),
        port: readUInt16BE(resp, resp.length - 2)
    };
}

export default { create, send, receive, holepunch, readable, writable }
