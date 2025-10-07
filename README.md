# Google Drive Bulk Ownership Transfer Script - for Google Apps Script

This script is divided into two main functions:
1. initiateBulkOwnershipTransfer (Must be run by the CURRENT owner)
2. acceptPendingOwnershipTransfers (Must be run by the NEW owner)

NOTE: For Google Workspace (work/school) accounts, ownership transfer
between users in the same domain is often automatic. However, this
two-step method is required for consumer (gmail.com) accounts.

## SETUP INSTRUCTIONS (MUST DO FIRST)

1. Go to Google Apps Script and open the Script Editor (Extensions -> Apps Script).
2. In the left sidebar, click the 'Services' (+) icon.
3. Scroll down and select 'Drive API' (v2). Click 'Add'.
4. Replace the placeholder email address in both scripts below.
5. Save the script (Ctrl+S or Cmd+S).
6. Run the functions as instructed below.

WARNING: For very large drives (thousands of files), this script
may hit the Google Apps Script execution limit (6 minutes) and stop.
If this happens, simply run the 'initiateBulkOwnershipTransfer'
script again, and it will pick up where it left off.

NOTE: Only tested with 'Drive API' version 2.
