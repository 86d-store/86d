import { bulkDeleteEndpoint } from "./bulk-delete";
import { createAssetEndpoint } from "./create-asset";
import { createFolderEndpoint } from "./create-folder";
import { deleteAssetEndpoint } from "./delete-asset";
import { deleteFolderEndpoint } from "./delete-folder";
import { adminGetAssetEndpoint } from "./get-asset";
import { adminListAssetsEndpoint } from "./list-assets";
import { listFoldersEndpoint } from "./list-folders";
import { moveAssetsEndpoint } from "./move-assets";
import { renameFolderEndpoint } from "./rename-folder";
import { statsEndpoint } from "./stats";
import { updateAssetEndpoint } from "./update-asset";

export const adminEndpoints = {
	"/admin/media": adminListAssetsEndpoint,
	"/admin/media/create": createAssetEndpoint,
	"/admin/media/bulk-delete": bulkDeleteEndpoint,
	"/admin/media/move": moveAssetsEndpoint,
	"/admin/media/stats": statsEndpoint,
	"/admin/media/folders": listFoldersEndpoint,
	"/admin/media/folders/create": createFolderEndpoint,
	"/admin/media/folders/:id": renameFolderEndpoint,
	"/admin/media/folders/:id/delete": deleteFolderEndpoint,
	"/admin/media/:id": adminGetAssetEndpoint,
	"/admin/media/:id/update": updateAssetEndpoint,
	"/admin/media/:id/delete": deleteAssetEndpoint,
};
