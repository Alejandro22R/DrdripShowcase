// Removes the Authenticode signature from a Windows executable.
//
// Injecting the program into a copy of node.exe changes the file, so the
// signature Node ships with stops matching. An .exe with a broken signature is
// treated worse by Windows than an unsigned one, so the signature is removed
// before packaging. Plain buffer work: no signtool needed, runs on any OS.

const CERT_DIRECTORY = 4;

/** @param {Buffer} input @returns {{ buffer: Buffer, removed: number }} */
export function stripSignature(input) {
  if (input.length < 0x40 || input.toString('latin1', 0, 2) !== 'MZ') throw new Error('Not a Windows executable (missing MZ header).');
  const pe = input.readUInt32LE(0x3c);
  if (pe + 24 > input.length || input.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('Not a Windows executable (missing PE header).');

  const optional = pe + 24;
  const magic = input.readUInt16LE(optional);
  if (magic !== 0x10b && magic !== 0x20b) throw new Error('Unknown PE format.');
  const directories = optional + (magic === 0x20b ? 112 : 96);
  const count = input.readUInt32LE(directories - 4);
  if (count <= CERT_DIRECTORY) return { buffer: input, removed: 0 };

  const entry = directories + CERT_DIRECTORY * 8;
  const offset = input.readUInt32LE(entry); // a file offset, unlike the other directories
  const size = input.readUInt32LE(entry + 4);
  if (offset === 0 || size === 0) return { buffer: input, removed: 0 };
  if (offset + size > input.length) throw new Error('Corrupt certificate table.');

  // The table normally sits at the very end; keep anything that follows it.
  const buffer = Buffer.concat([input.subarray(0, offset), input.subarray(offset + size)]);
  buffer.writeUInt32LE(0, entry);
  buffer.writeUInt32LE(0, entry + 4);
  buffer.writeUInt32LE(0, optional + 64); // checksum: 0 means "not set", which is valid for programs
  return { buffer, removed: size };
}
