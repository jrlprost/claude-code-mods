// Text from outside (an API, a status page, a cloned repository) is drawn only once it is
// printable: control characters, escape sequences included, become a visible "�" so nothing
// can move the cursor, recolour the terminal or hide what follows.
// Synced into each plugin's hooks/jr/ by scripts/sync-shared.sh.

// C0 controls (tab kept), DEL, C1 controls, and bidi overrides that reorder what is shown.
const UNPRINTABLE = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f‪-‮⁦-⁩]/g

export const printable = (text: unknown, max = 200) => {
  const s = String(text ?? '').replace(UNPRINTABLE, '�')
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
