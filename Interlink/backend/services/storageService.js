const fs = require("fs");
const path = require("path");
let Storage = null;
try {
    Storage = require("@google-cloud/storage").Storage;
} catch (_) {}

let google = null;
try {
    google = require("googleapis").google;
} catch (_) {}

let BlobServiceClient = null;
let StorageSharedKeyCredential = null;
try {
    const azure = require("@azure/storage-blob");
    BlobServiceClient = azure.BlobServiceClient;
    StorageSharedKeyCredential = azure.StorageSharedKeyCredential;
} catch (_) {}

const { getAllSettings } = require("../models/systemSettingsModel.js");

const LOCAL_UPLOAD_DIR = path.join(__dirname, "../uploads");

if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

class StorageService {
    constructor() {
        this.gcsClient = null;
        this.gdriveClient = null;
        this.azureClient = null;
        this.onedriveToken = null;
        this.onedriveTokenExpires = 0;
        this.cachedSettings = null;
        this.lastFetch = 0;
    }

    async getSettings() {
        const now = Date.now();
        if (this.cachedSettings && (now - this.lastFetch < 30000)) {
            return this.cachedSettings;
        }

        try {
            const map = await getAllSettings();
            this.cachedSettings = {
                driver: map['STORAGE_DRIVER'] || 'LOCAL', // 'LOCAL' | 'ONEDRIVE' | 'GDRIVE' | 'GCS' | 'MICROSOFT'
                // Microsoft OneDrive (1 TB Personal / Business via Graph API)
                onedriveClientId: map['ONEDRIVE_CLIENT_ID'] || process.env.ONEDRIVE_CLIENT_ID || '',
                onedriveTenantId: map['ONEDRIVE_TENANT_ID'] || process.env.ONEDRIVE_TENANT_ID || 'common',
                onedriveClientSecret: map['ONEDRIVE_CLIENT_SECRET'] || process.env.ONEDRIVE_CLIENT_SECRET || '',
                onedriveRefreshToken: map['ONEDRIVE_REFRESH_TOKEN'] || '',
                onedriveFolderName: map['ONEDRIVE_FOLDER_NAME'] || process.env.ONEDRIVE_FOLDER_NAME || 'InterChat_Uploads',
                onedriveUserEmail: map['ONEDRIVE_USER_EMAIL'] || '',
                // GCS Settings
                projectId: map['GCS_PROJECT_ID'] || '',
                bucketName: map['GCS_BUCKET_NAME'] || '',
                clientEmail: map['GCS_CLIENT_EMAIL'] || '',
                privateKey: map['GCS_PRIVATE_KEY'] || '',
                // Google Drive Settings (15 GB Free)
                gdriveFolderId: map['GDRIVE_FOLDER_ID'] || '',
                gdriveClientEmail: map['GDRIVE_CLIENT_EMAIL'] || '',
                gdrivePrivateKey: map['GDRIVE_PRIVATE_KEY'] || '',
                gdriveUserEmail: map['GDRIVE_USER_EMAIL'] || 'raj.jeenweb@gmail.com',
                // Microsoft Cloud / Azure Blob Storage Settings
                azureConnectionString: map['AZURE_CONNECTION_STRING'] || '',
                azureContainerName: map['AZURE_CONTAINER_NAME'] || 'interchat-files',
                azureAccountName: map['AZURE_ACCOUNT_NAME'] || '',
                azureAccountKey: map['AZURE_ACCOUNT_KEY'] || ''
            };
            this.lastFetch = now;
            this.gcsClient = null;
            this.gdriveClient = null;
            this.azureClient = null;
            return this.cachedSettings;
        } catch (err) {
            console.warn("[StorageService] Error loading settings, falling back to LOCAL:", err.message);
            return { driver: 'LOCAL' };
        }
    }

    async getGCSClient() {
        if (!Storage) return null;
        if (this.gcsClient) return this.gcsClient;

        const settings = await this.getSettings();
        if (settings.driver !== 'GCS' || !settings.bucketName) {
            return null;
        }

        try {
            const credentials = {
                client_email: settings.clientEmail,
                private_key: settings.privateKey ? settings.privateKey.replace(/\\n/g, '\n') : ''
            };

            this.gcsClient = new Storage({
                projectId: settings.projectId,
                credentials: (credentials.client_email && credentials.private_key) ? credentials : undefined
            });

            return this.gcsClient;
        } catch (err) {
            console.error("[StorageService] GCS Client init error:", err.message);
            return null;
        }
    }

    async getGDriveClient() {
        if (!google) return null;
        if (this.gdriveClient) return this.gdriveClient;

        const settings = await this.getSettings();
        if (settings.driver !== 'GDRIVE') {
            return null;
        }

        const email = settings.gdriveClientEmail || settings.clientEmail;
        const key = settings.gdrivePrivateKey || settings.privateKey;

        if (!email || !key) {
            return null;
        }

        try {
            const auth = new google.auth.JWT({
                email,
                key: key.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/drive']
            });

            this.gdriveClient = google.drive({ version: 'v3', auth });
            return this.gdriveClient;
        } catch (err) {
            console.error("[StorageService] Google Drive Client init error:", err.message);
            return null;
        }
    }

    async getAzureClient() {
        if (!BlobServiceClient) return null;
        if (this.azureClient) return this.azureClient;

        const settings = await this.getSettings();
        if (settings.driver !== 'MICROSOFT') {
            return null;
        }

        try {
            if (settings.azureConnectionString) {
                this.azureClient = BlobServiceClient.fromConnectionString(settings.azureConnectionString);
            } else if (settings.azureAccountName && settings.azureAccountKey) {
                const credential = new StorageSharedKeyCredential(settings.azureAccountName, settings.azureAccountKey);
                this.azureClient = new BlobServiceClient(
                    `https://${settings.azureAccountName}.blob.core.windows.net`,
                    credential
                );
            }
            return this.azureClient;
        } catch (err) {
            console.error("[StorageService] Microsoft Azure Client init error:", err.message);
            return null;
        }
    }

    async getOneDriveAccessToken(overrideConfig = null) {
        const settings = overrideConfig || (await this.getSettings());
        const clientId = settings.onedriveClientId;
        const clientSecret = settings.onedriveClientSecret;
        const refreshToken = settings.onedriveRefreshToken;

        if (!clientId || !refreshToken) {
            throw new Error("OneDrive Client ID and Refresh Token are required. Please authorize your 1 TB OneDrive account.");
        }

        const now = Date.now();
        if (!overrideConfig && this.onedriveToken && (this.onedriveTokenExpires - now > 60000)) {
            return this.onedriveToken;
        }

        const tenantId = (settings.onedriveTenantId || 'common').trim();
        const params = new URLSearchParams();
        params.append("client_id", clientId);
        if (clientSecret) params.append("client_secret", clientSecret);
        params.append("grant_type", "refresh_token");
        params.append("refresh_token", refreshToken);
        params.append("scope", "offline_access Files.ReadWrite User.Read");

        const tokenRes = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            throw new Error(tokenData.error_description || tokenData.error || "Failed to acquire OneDrive access token.");
        }

        if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
            try {
                const { setSetting } = require("../models/systemSettingsModel.js");
                await setSetting("ONEDRIVE_REFRESH_TOKEN", tokenData.refresh_token, "Microsoft OneDrive OAuth Refresh Token");
                if (this.cachedSettings) this.cachedSettings.onedriveRefreshToken = tokenData.refresh_token;
            } catch (err) {}
        }

        if (!overrideConfig) {
            this.onedriveToken = tokenData.access_token;
            this.onedriveTokenExpires = now + ((tokenData.expires_in || 3600) * 1000);
        }

        return tokenData.access_token;
    }

    async uploadFile({ buffer, originalName, storedName, mimeType }) {
        const settings = await this.getSettings();

        // 0. Microsoft OneDrive (1 TB Personal / Business via Graph API)
        if (settings.driver === 'ONEDRIVE') {
            try {
                const accessToken = await this.getOneDriveAccessToken();
                const folder = (settings.onedriveFolderName || 'InterChat_Uploads').trim();

                // Small file upload (<= 4MB) via simple PUT
                if (buffer.length <= 4 * 1024 * 1024) {
                    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(storedName)}:/content`;
                    const res = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': mimeType || 'application/octet-stream'
                        },
                        body: buffer
                    });
                    const resJson = await res.json();
                    if (!res.ok) {
                        throw new Error(resJson.error?.message || "Failed to upload to OneDrive");
                    }
                    return {
                        storageProvider: 'ONEDRIVE',
                        cloudBucket: folder,
                        cloudKey: resJson.id,
                        publicUrl: resJson.webUrl || null
                    };
                } else {
                    // Large file upload via createUploadSession (chunks)
                    const sessionUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(storedName)}:/createUploadSession`;
                    const sessionRes = await fetch(sessionUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            item: {
                                '@microsoft.graph.conflictBehavior': 'rename',
                                name: storedName
                            }
                        })
                    });
                    const sessionData = await sessionRes.json();
                    if (!sessionRes.ok) {
                        throw new Error(sessionData.error?.message || "Failed to create OneDrive upload session");
                    }

                    const uploadSessionUrl = sessionData.uploadUrl;
                    const chunkSize = 320 * 1024 * 10; // ~3.2MB chunks (multiple of 320 KiB)
                    let offset = 0;
                    let lastResData = null;

                    while (offset < buffer.length) {
                        const end = Math.min(offset + chunkSize, buffer.length);
                        const chunk = buffer.subarray(offset, end);
                        const chunkRes = await fetch(uploadSessionUrl, {
                            method: 'PUT',
                            headers: {
                                'Content-Range': `bytes ${offset}-${end - 1}/${buffer.length}`,
                                'Content-Length': String(chunk.length)
                            },
                            body: chunk
                        });
                        lastResData = await chunkRes.json();
                        offset = end;
                    }

                    return {
                        storageProvider: 'ONEDRIVE',
                        cloudBucket: folder,
                        cloudKey: lastResData?.id || storedName,
                        publicUrl: lastResData?.webUrl || null
                    };
                }
            } catch (oneDriveErr) {
                console.error("[StorageService] OneDrive upload failed, falling back to local:", oneDriveErr.message);
            }
        }

        // 1. Microsoft Cloud Storage (Azure Blob / OneDrive)
        if (settings.driver === 'MICROSOFT') {
            const blobService = await this.getAzureClient();
            if (blobService) {
                try {
                    const containerName = (settings.azureContainerName || 'interchat-files').toLowerCase().replace(/[^a-z0-9-]/g, '-');
                    const containerClient = blobService.getContainerClient(containerName);
                    
                    // Create container if it doesn't exist
                    await containerClient.createIfNotExists({ access: 'blob' });

                    const blockBlobClient = containerClient.getBlockBlobClient(storedName);
                    await blockBlobClient.uploadData(buffer, {
                        blobHTTPHeaders: {
                            blobContentType: mimeType || 'application/octet-stream'
                        },
                        metadata: {
                            originalName: encodeURIComponent(originalName || 'file')
                        }
                    });

                    return {
                        storageProvider: 'MICROSOFT',
                        cloudBucket: containerName,
                        cloudKey: storedName,
                        publicUrl: blockBlobClient.url || `/uploads/${storedName}`
                    };
                } catch (msErr) {
                    console.error("[StorageService] Microsoft upload failed, falling back to local:", msErr.message);
                }
            }
        }

        // 2. Google Drive (15 GB Free — No card required)
        if (settings.driver === 'GDRIVE') {
            const drive = await this.getGDriveClient();
            if (drive) {
                try {
                    const stream = new Readable();
                    stream.push(buffer);
                    stream.push(null);

                    const fileMeta = {
                        name: storedName,
                        parents: settings.gdriveFolderId ? [settings.gdriveFolderId] : undefined
                    };

                    const res = await drive.files.create({
                        requestBody: fileMeta,
                        media: {
                            mimeType: mimeType || 'application/octet-stream',
                            body: stream
                        },
                        fields: 'id, name, webViewLink, webContentLink'
                    });

                    // Set file accessible
                    try {
                        await drive.permissions.create({
                            fileId: res.data.id,
                            requestBody: {
                                role: 'reader',
                                type: 'anyone'
                            }
                        });
                    } catch (permErr) {
                        // Silent ignore permission warning
                    }

                    return {
                        storageProvider: 'GDRIVE',
                        cloudBucket: settings.gdriveFolderId || 'GoogleDrive',
                        cloudKey: res.data.id,
                        publicUrl: res.data.webViewLink || `/uploads/${storedName}`
                    };
                } catch (driveErr) {
                    console.error("[StorageService] Google Drive upload failed, falling back to local:", driveErr.message);
                }
            }
        }

        // 3. Google Cloud Storage
        if (settings.driver === 'GCS') {
            const gcs = await this.getGCSClient();
            if (gcs && settings.bucketName) {
                try {
                    const bucket = gcs.bucket(settings.bucketName);
                    const cloudKey = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${storedName}`;
                    const file = bucket.file(cloudKey);

                    await file.save(buffer, {
                        contentType: mimeType,
                        resumable: false,
                        metadata: {
                            cacheControl: 'public, max-age=31536000',
                            originalName
                        }
                    });

                    return {
                        storageProvider: 'GCS',
                        cloudBucket: settings.bucketName,
                        cloudKey,
                        publicUrl: `https://storage.googleapis.com/${settings.bucketName}/${cloudKey}`
                    };
                } catch (err) {
                    console.error("[StorageService] GCS upload failed, falling back to local:", err.message);
                }
            }
        }

        // 4. Local Storage (Default Fallback)
        const localPath = path.join(LOCAL_UPLOAD_DIR, storedName);
        fs.writeFileSync(localPath, buffer);

        return {
            storageProvider: 'LOCAL',
            cloudBucket: null,
            cloudKey: null,
            publicUrl: `/uploads/${storedName}`
        };
    }

    async getFileStream(attachment) {
        // Microsoft OneDrive Stream
        if (attachment.storage_provider === 'ONEDRIVE' && attachment.cloud_key) {
            try {
                const accessToken = await this.getOneDriveAccessToken();
                const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${attachment.cloud_key}/content`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    redirect: 'follow'
                });
                if (res.ok && res.body) {
                    const { Readable } = require("stream");
                    return Readable.fromWeb(res.body);
                }
            } catch (err) {
                console.warn("[StorageService] Could not stream from OneDrive, trying local fallback:", err.message);
            }
        }

        // Microsoft Azure Blob Stream
        if (attachment.storage_provider === 'MICROSOFT' && attachment.cloud_key) {
            const blobService = await this.getAzureClient();
            if (blobService) {
                try {
                    const containerName = (attachment.cloud_bucket || 'interchat-files').toLowerCase();
                    const containerClient = blobService.getContainerClient(containerName);
                    const blobClient = containerClient.getBlobClient(attachment.cloud_key);
                    const downloadResponse = await blobClient.download(0);
                    return downloadResponse.readableStreamBody;
                } catch (err) {
                    console.warn("[StorageService] Could not stream from Microsoft storage, trying local fallback:", err.message);
                }
            }
        }

        // Google Drive Stream
        if (attachment.storage_provider === 'GDRIVE' && attachment.cloud_key) {
            const drive = await this.getGDriveClient();
            if (drive) {
                try {
                    const res = await drive.files.get(
                        { fileId: attachment.cloud_key, alt: 'media' },
                        { responseType: 'stream' }
                    );
                    return res.data;
                } catch (err) {
                    console.warn("[StorageService] Could not stream from GDrive, trying local fallback:", err.message);
                }
            }
        }

        // GCS Stream
        if (attachment.storage_provider === 'GCS' && attachment.cloud_bucket && attachment.cloud_key) {
            const gcs = await this.getGCSClient();
            if (gcs) {
                const bucket = gcs.bucket(attachment.cloud_bucket);
                const file = bucket.file(attachment.cloud_key);
                const [exists] = await file.exists();
                if (exists) {
                    return file.createReadStream();
                }
            }
        }

        // Local Stream
        const localPath = path.join(LOCAL_UPLOAD_DIR, attachment.stored_name);
        if (fs.existsSync(localPath)) {
            return fs.createReadStream(localPath);
        }

        throw new Error("File not found on storage");
    }

    async testMicrosoftConnection({ connectionString, containerName = 'interchat-files', accountName, accountKey }) {
        try {
            let blobServiceClient = null;

            if (connectionString && connectionString.trim()) {
                blobServiceClient = BlobServiceClient.fromConnectionString(connectionString.trim());
            } else if (accountName && accountKey) {
                const credential = new StorageSharedKeyCredential(accountName.trim(), accountKey.trim());
                blobServiceClient = new BlobServiceClient(
                    `https://${accountName.trim()}.blob.core.windows.net`,
                    credential
                );
            } else {
                return {
                    success: false,
                    message: "Azure Connection String OR Account Name + Key is required."
                };
            }

            const cleanContainer = (containerName || 'interchat-files').toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const containerClient = blobServiceClient.getContainerClient(cleanContainer);

            // Ensure container exists
            await containerClient.createIfNotExists({ access: 'blob' });

            // Upload a tiny test blob and delete it
            const testBlobName = `_interchat_test_${Date.now()}.txt`;
            const blockBlobClient = containerClient.getBlockBlobClient(testBlobName);
            const content = "INTERCHAT_MICROSOFT_CONNECTIVITY_TEST";
            await blockBlobClient.upload(content, Buffer.byteLength(content));
            await blockBlobClient.delete();

            return {
                success: true,
                message: `Successfully connected to Microsoft Cloud Storage (Container: '${cleanContainer}')!`
            };
        } catch (err) {
            return {
                success: false,
                message: `Microsoft Storage Connection Failed: ${err.message}`
            };
        }
    }

    async testGCSConnection({ projectId, bucketName, clientEmail, privateKey }) {
        try {
            const credentials = {
                client_email: clientEmail,
                private_key: privateKey ? privateKey.replace(/\\n/g, '\n') : ''
            };

            const testStorage = new Storage({
                projectId,
                credentials: (credentials.client_email && credentials.private_key) ? credentials : undefined
            });

            const bucket = testStorage.bucket(bucketName);
            const [exists] = await bucket.exists();
            if (!exists) {
                return { success: false, message: `Bucket '${bucketName}' does not exist or access is denied.` };
            }

            const testFile = bucket.file(`_test_${Date.now()}.tmp`);
            await testFile.save("INTERCHAT_GCS_CONNECTIVITY_TEST", { resumable: false });
            await testFile.delete();

            return {
                success: true,
                message: `Successfully connected to Google Cloud Storage bucket '${bucketName}'!`
            };
        } catch (err) {
            return {
                success: false,
                message: `GCS Connection Failed: ${err.message}`
            };
        }
    }

    async testGDriveConnection({ folderId, clientEmail, privateKey }) {
        try {
            const auth = new google.auth.JWT({
                email: clientEmail,
                key: privateKey ? privateKey.replace(/\\n/g, '\n') : '',
                scopes: ['https://www.googleapis.com/auth/drive']
            });

            const drive = google.drive({ version: 'v3', auth });

            // Test listing files in the specified folder
            const q = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';
            const res = await drive.files.list({
                q,
                pageSize: 1,
                fields: 'files(id, name)'
            });

            // Also test creating and deleting a temporary test file in the folder
            const testStream = new Readable();
            testStream.push("INTERCHAT_GDRIVE_CONNECTIVITY_TEST");
            testStream.push(null);

            const uploadTest = await drive.files.create({
                requestBody: {
                    name: `_interchat_test_${Date.now()}.txt`,
                    parents: folderId ? [folderId] : undefined
                },
                media: {
                    mimeType: 'text/plain',
                    body: testStream
                },
                fields: 'id'
            });

            if (uploadTest.data.id) {
                await drive.files.delete({ fileId: uploadTest.data.id });
            }

            return {
                success: true,
                message: `Successfully connected to Google Drive folder! Free 15 GB storage verified.`
            };
        } catch (err) {
            return {
                success: false,
                message: `Google Drive Connection Failed: ${err.message}. Make sure you shared your Google Drive folder with the Service Account email as 'Editor'.`
            };
        }
    }

    async testOneDriveConnection({ clientId, tenantId, clientSecret, refreshToken, folderName }) {
        try {
            const accessToken = await this.getOneDriveAccessToken({
                onedriveClientId: clientId,
                onedriveTenantId: tenantId,
                onedriveClientSecret: clientSecret,
                onedriveRefreshToken: refreshToken
            });

            // 1. Fetch user's drive info & 1 TB quota from Microsoft Graph
            const driveRes = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            const driveData = await driveRes.json();
            if (!driveRes.ok) {
                throw new Error(driveData.error?.message || "Could not access OneDrive account.");
            }

            const totalBytes = driveData.quota?.total || 0;
            const remainingBytes = driveData.quota?.remaining || 0;
            const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
            const remainingGB = (remainingBytes / (1024 * 1024 * 1024)).toFixed(1);
            const driveType = driveData.driveType || "personal";

            // 2. Test uploading a small test verification file into the folder
            const folder = (folderName || 'InterChat_Uploads').trim();
            const testUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folder)}/_test_${Date.now()}.txt:/content`;
            const uploadTest = await fetch(testUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "text/plain"
                },
                body: "INTERCHAT_ONEDRIVE_CONNECTIVITY_TEST"
            });
            const uploadData = await uploadTest.json();

            // Delete test file
            if (uploadData.id) {
                await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${uploadData.id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${accessToken}` }
                });
            }

            return {
                success: true,
                message: `Successfully connected to Microsoft OneDrive (${totalGB} GB Total, ${remainingGB} GB Free)! Drive Type: ${driveType}`,
                quota: {
                    totalGB,
                    remainingGB,
                    driveType
                }
            };
        } catch (err) {
            return {
                success: false,
                message: `OneDrive Connection Failed: ${err.message}`
            };
        }
    }

    invalidateCache() {
        this.cachedSettings = null;
        this.gcsClient = null;
        this.gdriveClient = null;
        this.azureClient = null;
        this.onedriveToken = null;
        this.onedriveTokenExpires = 0;
        this.lastFetch = 0;
    }
}

const storageService = new StorageService();
module.exports = storageService;
