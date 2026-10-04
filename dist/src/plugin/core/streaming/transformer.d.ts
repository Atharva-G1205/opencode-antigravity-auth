import type { SignatureStore, StreamingCallbacks, StreamingOptions, ThoughtBuffer } from './types';
export declare const CLEAN_GUARDRAIL_MESSAGE = "[Solicitud bloqueada por filtros de seguridad de Gemini. Por favor, intenta reformular tu prompt o enfoque.]";
export declare const CLEAN_MALFORMED_CALL_MESSAGE = "[Llamada de herramienta vac\u00EDa o malformada generada por el modelo. Reintentando o reformula tu solicitud.]";
export declare const LOOP_DETECTED_MALFORMED_MESSAGE = "[Bucle de llamadas malformadas consecutivas detectado. La solicitud ha sido detenida para evitar bucle infinito. Por favor reformula tu prompt.]";
/**
 * Checks if a text is the generic verbose Gemini filter blocking message
 * and replaces it with a clean, concise prompt rephrase invitation.
 */
export declare function sanitizeGuardrailText(text: string): string;
/**
 * Replaces verbose Google safety filter messages in response candidates
 * with a concise rephrasing invitation. Also handles MALFORMED_FUNCTION_CALL
 * finishReason by rewriting to STOP with explanatory content to avoid hard session crash.
 */
export declare function sanitizeGuardrailMessage(response: unknown, sessionKey?: string): unknown;
export declare function createThoughtBuffer(): ThoughtBuffer;
export declare function transformStreamingPayload(payload: string, transformThinkingParts?: (response: unknown) => unknown): string;
export declare function deduplicateThinkingText(response: unknown, sentBuffer: ThoughtBuffer, displayedThinkingHashes?: Set<string>): unknown;
export declare function transformSseLine(line: string, signatureStore: SignatureStore, thoughtBuffer: ThoughtBuffer, sentThinkingBuffer: ThoughtBuffer, callbacks: StreamingCallbacks, options: StreamingOptions, debugState: {
    injected: boolean;
}): string;
export declare function cacheThinkingSignaturesFromResponse(response: unknown, signatureSessionKey: string, signatureStore: SignatureStore, thoughtBuffer: ThoughtBuffer, onCacheSignature?: (sessionKey: string, text: string, signature: string) => void): void;
export declare function createStreamingTransformer(signatureStore: SignatureStore, callbacks: StreamingCallbacks, options?: StreamingOptions): TransformStream<Uint8Array, Uint8Array>;
//# sourceMappingURL=transformer.d.ts.map