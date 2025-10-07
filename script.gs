/**
 * =================================================================
 * Google Drive Bulk Ownership Transfer Script
 * =================================================================
 *
 * This script is divided into two main functions:
 * 1. initiateBulkOwnershipTransfer (Must be run by the CURRENT owner)
 * 2. acceptPendingOwnershipTransfers (Must be run by the NEW owner)
 *
 * NOTE: For Google Workspace (work/school) accounts, ownership transfer
 * between users in the same domain is often automatic. However, this
 * two-step method is required for consumer (gmail.com) accounts.
 *
 * -----------------------------------------------------------------
 * === SETUP INSTRUCTIONS (MUST DO FIRST) ===
 * -----------------------------------------------------------------
 * 1. Open the Script Editor (Extensions -> Apps Script).
 * 2. In the left sidebar, click the 'Services' (+) icon.
 * 3. Scroll down and select 'Drive API' (v2). Click 'Add'.
 * 4. Replace the placeholder email address in both scripts below.
 * 5. Save the script (Ctrl+S or Cmd+S).
 * 6. Run the functions as instructed below.
 *
 * WARNING: For very large drives (thousands of files), this script
 * may hit the Google Apps Script execution limit (6 minutes) and stop.
 * If this happens, simply run the 'initiateBulkOwnershipTransfer'
 * script again, and it will pick up where it left off.
 */

// ***************************************************************
// 1. SCRIPT FOR THE CURRENT OWNER (USER A) - INITIATE TRANSFER
// ***************************************************************

/**
 * Iterates through all files owned by the current user and sends
 * an ownership transfer request to the new owner.
 * Files that already have a pending transfer request are skipped.
 */
function initiateBulkOwnershipTransfer() {
    // === EDIT THIS LINE WITH THE NEW OWNER'S EMAIL ADDRESS ===
    const NEW_OWNER_EMAIL = "new.owner@example.com";
    // ========================================================

    if (NEW_OWNER_EMAIL === "new.owner@example.com") {
        Logger.log("ERROR: Please update the NEW_OWNER_EMAIL variable with the correct email address.");
        return;
    }

    // Query to find all files owned by the current user that are not in the trash.
    const query = "'me' in owners and trashed = false"; // you could also add a date parameter to filter by date also "and modifiedDate < '2025-01-01'"
    const files = DriveApp.searchFiles(query);
    let initiatedCount = 0;
    let errorCount = 0;

    Logger.log(`Starting ownership transfer initiation to ${NEW_OWNER_EMAIL}...`);

    while (files.hasNext()) {
        const file = files.next();
        const fileId = file.getId();

        try {
            // ----------------------------------------------------------------------------------
            // FIX FOR TIMEOUT/RESUME: Check if a transfer request is already pending.
            // This prevents the script from wasting time re-processing files after a timeout.
            // ----------------------------------------------------------------------------------
            const permissions = Drive.Permissions.list(fileId, { 'supportsAllDrives': true }).items;
            let isTransferPending = false;

            for (const p of permissions) {
                // Check if the permission belongs to the new owner and is set to pending
                if (p.emailAddress === NEW_OWNER_EMAIL && p.pendingOwner) {
                    isTransferPending = true;
                    break;
                }
            }

            if (isTransferPending) {
                continue;
            }

            // Attempt to transfer ownership using the Advanced Drive API.
            Drive.Permissions.insert(
                {
                    'role': 'writer', // Temporarily set them as a writer
                    'type': 'user',
                    'value': NEW_OWNER_EMAIL,
                    'pendingOwner': true // Marks the ownership transfer request
                },
                fileId,
                {
                    // Suppress emails to prevent inbox spam for the new owner
                    'sendNotificationEmails': false,
                    'supportsAllDrives': true
                }
            );

            initiatedCount++;
        } catch (e) {
            // Log any errors (e.g., file permissions, rate limiting, Shared Drive files)
            Logger.log(`ERROR on file ${file.getName()} (${fileId}): ${e.toString()}`);
            errorCount++;
        }

        // Log progress every 10 files
        if (initiatedCount % 10 === 0 && initiatedCount > 0) {
            Logger.log(`... Progress: ${initiatedCount} transfers initiated so far.`);
        }
    }

    Logger.log("=================================================");
    Logger.log(`TRANSFER INITIATION COMPLETE!`);
    Logger.log(`Total initiated: ${initiatedCount}`);
    Logger.log(`Total errors/skips: ${errorCount}`);
    Logger.log(`NEXT STEP: The new owner (${NEW_OWNER_EMAIL}) MUST now run the 'acceptPendingOwnershipTransfers' script.`);
    Logger.log("=================================================");
}

// ***************************************************************
// 2. SCRIPT FOR THE NEW OWNER (USER B) - ACCEPT TRANSFER
// ***************************************************************

/**
 * Searches for all files that have a pending ownership transfer request
 * directed to the current user (the new owner) and accepts them.
 *
 * This script MUST be run by the NEW OWNER account.
 */
function acceptPendingOwnershipTransfers() {
    // === EDIT THIS LINE WITH THE EMAIL ADDRESS OF THE PREVIOUS OWNER ===
    const OLD_OWNER_EMAIL = "your.current.email@example.com";
    // =================================================================

    if (OLD_OWNER_EMAIL === "your.current.email@example.com") {
        Logger.log("ERROR: Please update the OLD_OWNER_EMAIL variable with the correct email address (the sender).");
        return;
    }

    // Query to find all files where the current user has a pending ownership request from the old owner.
    // 'pendingowner:me' finds all files the current user needs to accept ownership for.
    const query = 'pendingowner:me and trashed = false';
    const files = DriveApp.searchFiles(query);
    const currentUserEmail = Session.getActiveUser().getEmail();
    let acceptedCount = 0;
    let errorCount = 0;

    Logger.log("Starting ownership transfer acceptance...");

    while (files.hasNext()) {
        const file = files.next();
        const fileId = file.getId();

        try {
            // ----------------------------------------------------------------------------------
            // FIX FOR TIMEOUT/RESUME: If the file is already owned by the current user, skip it.
            // This prevents the script from wasting time re-processing successfully accepted files
            // if the search index is slow to update after a previous run timed out.
            // ----------------------------------------------------------------------------------
            if (file.getOwner().getEmail() === currentUserEmail) {
                Logger.log(`Skipping file ${file.getName()}: Already owned by current user (likely processed in a prior run).`);
                continue;
            }

            // Find the permission ID for the current user on this file
            const permissions = Drive.Permissions.list(fileId, { 'supportsAllDrives': true }).items;
            let permissionId = null;

            for (const p of permissions) {
                // Check if the permission belongs to the current user (User B) and is pending
                if (p.emailAddress === currentUserEmail && p.pendingOwner) {
                    permissionId = p.id;
                    break;
                }
            }

            if (permissionId) {
                // Update the permission, setting 'role' to 'owner' and 'transferOwnership' to true
                Drive.Permissions.update(
                    { 'role': 'owner' },
                    fileId,
                    permissionId,
                    {
                        'transferOwnership': true, // This is the key for accepting the transfer
                        'sendNotificationEmails': false,
                        'supportsAllDrives': true
                    }
                );
                acceptedCount++;
            } else {
                Logger.log(`Skipping file ${file.getName()}: No pending request found.`);
            }

        } catch (e) {
            Logger.log(`ERROR accepting ownership for file ${file.getName()} (${fileId}): ${e.toString()}`);
            errorCount++;
        }

        // Log progress every 10 files
        if (acceptedCount % 10 === 0 && acceptedCount > 0) {
            Logger.log(`... Progress: ${acceptedCount} transfers accepted so far.`);
        }
    }

    Logger.log("=================================================");
    Logger.log(`TRANSFER ACCEPTANCE COMPLETE!`);
    Logger.log(`Total accepted: ${acceptedCount}`);
    Logger.log(`Total errors/skips: ${errorCount}`);
    Logger.log("=================================================");
}
