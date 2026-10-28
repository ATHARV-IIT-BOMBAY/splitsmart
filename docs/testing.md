# Test report

The judges' 9 robustness tests, run on real phones. Live app: https://atharv-iit-bombay.github.io/splitsmart/

**How to fill this in:** do each test on your phone, then write what happened in plain words. Put ✅ if it worked, ❌ if it broke, ⚠️ if it worked but was confusing. Add a screenshot to `docs/screenshots/` if something broke.

**Tested on:** _Samsung S25_, _browser Chrome_, _25/10/2026_ and _Macbook Air M1_, _browser Safari_

| # | Test | What to do | What should happen | What happened | Result |
|---|---|---|---|---|---|
| 1 | Clear printed bill with GST | Scan a clear restaurant bill | Items, tax and total read with few fixes |Improved, but still some items are left to read, tax on read this time| ⚠️ |
| 2 | Faded thermal receipt | Scan a faded canteen slip | Unsure words highlighted yellow; you can fix them |Couldn’t read this photo| ⚠️|
| 3 | Rotated photo | Take the photo sideways or upside down | Still reads it, or offers Rotate / Retake |NOT no items error found this time but not reading most of the item names |⚠️|
| 4 | Not a receipt | Scan a selfie or a wall | "No items found" with Retake / Type items |No items found on this photo, offered retake |✅ |
| 5 | No printed total | Scan a bill with no total at the bottom | Total worked out from items; asks you to check | Yes, asked to check| ✅ |
| 6 | ₹100 split three ways | Add ₹100 expense split equally between 3 | Shares are 33.34, 33.33, 33.33 | works| ✅ |
| 7 | Camera blocked | Block camera for the site, then tap Take photo | Clear message + Upload photo works |works |✅ |
| 8 | Offline | Open the app once, turn on airplane mode, reopen | App opens with saved groups | | ✅ |
| 9 | 5 people, 10 expenses | Make a group of 5, add 10 expenses, different payers | Settle up shows the fewest payments |It works |✅ |
| 10 | Categories | scan a bill and check that the 🍔 Food / 🛒 Groceries chips make sense|A bill can be allocated a category to make it more organised| Yes, It works and makes sense | ✅ |
| 11 | UPI | in Balances, add a UPI ID, tap Pay with UPI, and check that GPay/PhonePe opens with the right amount (don’t actually pay )|Payment to the UPI id should be possible| works | ✅ |
|12| Remind and QR code| QR code and Remind buttons on a payment|A QR code should be displayed which when scanned with payment app shows correct amount of payment. A reminder can be added to phone's dedicated app| Works |✅ |
| 13 | Group Sharing | Share a group: Group → Share · Edit → QR code → scan it with the other device → the group appears| website link should open on the other phone with the app group dialog box |works | ✅ |
|14|Settlement report (PDF)|Balances → report → Save as PDF|A PDF file with report should download|works|✅ |
|15|Install|Chrome menu → Add to Home screen → opens like an app|SplitSmart is added to the home screen|works|✅ |
|16|Try a sample bill|Scan receipt → Try a sample bill |An older uploaded bill appears that can be scanned|works|✅|

## Bugs found

| What I did | What went wrong | Phone and browser | Screenshot |
| rotated bill | Item names not recognised | both | |
| faded bill | mis spelled item names | | |
| clear bill showed tax in item category | | |

