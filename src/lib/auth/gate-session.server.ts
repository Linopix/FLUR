/**
 * Gate sessions used to be minted through Better Auth. FLUR does not use that
 * library. The provider id stays so older imports keep compiling.
 */
export const GATE_PROVIDER_ID = "grok-gate";

export function gateIdentitySessions() {
  return { id: "grok-gate-identity", hooks: { before: [] as unknown[] } };
}
