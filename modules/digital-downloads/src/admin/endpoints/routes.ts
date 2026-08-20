import { createFile } from "./create-file";
import { createToken } from "./create-token";
import { createTokenBatch } from "./create-token-batch";
import { deleteFile } from "./delete-file";
import { getFile } from "./get-file";
import { getToken } from "./get-token";
import { listFiles } from "./list-files";
import { listTokens } from "./list-tokens";
import { revokeToken } from "./revoke-token";
import { updateFile } from "./update-file";

export const adminEndpoints = {
	// Files
	"/admin/downloads/files": listFiles,
	"/admin/downloads/files/create": createFile,
	"/admin/downloads/files/:id": getFile,
	"/admin/downloads/files/:id/update": updateFile,
	"/admin/downloads/files/:id/delete": deleteFile,
	// Tokens
	"/admin/downloads/tokens": listTokens,
	"/admin/downloads/tokens/create": createToken,
	"/admin/downloads/tokens/batch": createTokenBatch,
	"/admin/downloads/tokens/:id": getToken,
	"/admin/downloads/tokens/:id/revoke": revokeToken,
};
