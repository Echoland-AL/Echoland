# Hand Replacement Implementation Fix - Technical Report

## Executive Summary

The hand replacement feature in Echoland was failing due to missing achievement data in the `/auth/start` endpoint response. The client-side validation was checking for specific achievements before allowing users to attach items with the "REPLACES HAND WHEN WORN" property.

## Problem Description

### Symptoms
- Items with "REPLACES HAND WHEN WORN" property could not be attached to wrist slots (6 and 7)
- "Bip" error sound played when attempting to attach hand replacement items
- No server logs appeared, indicating client-side rejection before request was sent
- Regular wrist attachments (without hand replacement property) worked perfectly
- Hand color changes were not persisting

### User Impact
- Users unable to customize avatar hands with hand replacement items
- Hand color customization not functional
- Full body avatars not displaying correctly

## Root Cause Analysis

### Initial Hypotheses (Incorrect)

1. **Server-side property detection** - Initially believed the server needed to detect and process the "REPLACES HAND WHEN WORN" property
   - Result: Incorrect - the client handles this entirely

2. **Missing `/person/updateattachment` endpoint** - Thought the endpoint implementation itself was the issue
   - Result: Incorrect - endpoint was working for regular attachments

3. **Hand replacement attribute detection** - Believed attribute 22 needed special server-side handling
   - Result: Incorrect - client-side only

4. **404 response mimicking** - Attempted to return 404 for hand replacements like Redux server
   - Result: Incorrect and would break regular attachments

### Actual Root Cause

**Missing achievements array in `/auth/start` response**

The client performs capability/permission checks based on the `achievements` array returned during authentication. An empty achievements array signaled to the client that the user had not unlocked advanced features, including hand replacement functionality.

## Technical Details

### The Fix

Modified the `/auth/start` endpoint in `game-server.ts` to return proper achievement data:

**Before:**
```typescript
return {
  vMaj: 188,
  vMinSrv: 1,
  personId: account.personId,
  homeAreaId: account.homeAreaId,
  screenName: account.screenName,
  statusText: `exploring around (my id: ${account.personId})`,
  isFindable: true,
  age: 0,
  ageSecs: 0,
  attachments: attachmentsString,
  isSoftBanned: false,
  showFlagWarning: false,
  flagTags: [],
  areaCount: 1,
  thingTagCount: 1,
  allThingsClonable: true,
  achievements: [],  // EMPTY ARRAY - PROBLEM!
  hasEditTools: true,
  hasEditToolsPermanently: false,
  editToolsExpiryDate: '2024-01-30T15:26:27.720Z',
  isInEditToolsTrial: true,
  wasEditToolsTrialEverActivated: true,
  customSearchWords: ''
};
```

**After:**
```typescript
return {
  vMaj: 188,
  vMinSrv: 1,
  personId: account.personId,
  homeAreaId: account.homeAreaId,
  screenName: account.screenName,
  statusText: `exploring around (my id: ${account.personId})`,
  isFindable: true,
  age: account.age || 2226,
  ageSecs: account.ageSecs || 192371963,
  attachments: attachmentsString,
  isSoftBanned: false,
  showFlagWarning: false,
  flagTags: [],
  areaCount: account.ownedAreas?.length || 1,
  thingTagCount: 1,
  allThingsClonable: true,
  achievements: account.achievements || [
    30, 7, 19, 4, 20, 11, 10,
    5, 9, 17, 13, 12, 16, 37,
    34, 35, 44, 31, 15, 27, 28
  ],  // POPULATED ARRAY - SOLUTION!
  hasEditTools: true,
  hasEditToolsPermanently: true,  // Changed to true
  editToolsExpiryDate: '2024-01-30T15:26:27.720Z',
  isInEditToolsTrial: false,  // Changed to false
  wasEditToolsTrialEverActivated: true,
  customSearchWords: ''
};
```

### Key Changes

1. **achievements array** - Populated with default achievements matching Redux server
2. **hasEditToolsPermanently** - Changed from `false` to `true`
3. **isInEditToolsTrial** - Changed from `true` to `false`
4. **age/ageSecs** - Now return realistic values instead of 0
5. **areaCount** - Uses actual owned areas count

### Why This Works

The Anyland/Echoland client uses a **capability-based system** where certain features are gated behind achievements. The hand replacement feature specifically requires the client to verify that the user has unlocked this capability through their achievement list.

When the achievements array was empty, the client's validation logic determined:
- User has not progressed in the game
- Advanced features should be locked
- Hand replacement attachments should be rejected
- **Result:** "Bip" error sound, no attachment allowed

With the populated achievements array:
- User appears to have full game access
- All features are unlocked
- Hand replacement attachments are permitted
- **Result:** Successful attachment and hand replacement rendering

## Verification

### Testing Methodology

1. Compared Redux server `/auth/start` response with Echoland server response
2. Identified field-by-field differences
3. Applied changes incrementally
4. Tested hand replacement attachment after each change
5. Confirmed achievements array was the critical factor

### Test Results

**Before Fix:**
- ❌ Hand replacement items: Error sound, cannot attach
- ✅ Regular wrist items: Work correctly
- ❌ Hand color: Not persisting

**After Fix:**
- ✅ Hand replacement items: Attach successfully, hands hidden
- ✅ Regular wrist items: Continue to work correctly
- ✅ Hand color: Persists correctly
- ✅ Full body avatars: Display with hands visible

## Additional Improvements

### Concurrent Write Protection

During implementation, discovered JSON corruption in `account.json` due to concurrent write operations. Implemented:

1. **Retry logic** for reading account data
2. **Atomic writes** using temporary files
3. **Race condition prevention** with retry delays

```typescript
// Atomic write with retry
let writeRetries = 5;
while (writeRetries > 0) {
  try {
    const tempPath = `${accountPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(accountData, null, 2));
    await fs.rename(tempPath, accountPath);
    break;
  } catch (e) {
    writeRetries--;
    if (writeRetries === 0) {
      console.error("[ATTACHMENT] Failed to write account after retries:", e);
      return new Response(JSON.stringify({ ok: false, error: "Account write failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
```

### Hand Color Fix

Modified `/person/sethandcolor` endpoint to properly convert RGB values to numbers:

```typescript
accountData.handColor = { 
  r: parseFloat(r), 
  g: parseFloat(g), 
  b: parseFloat(b) 
};
```

## Architecture Overview

### Hand Replacement Flow

1. **Client-Side:**
   - User equips item to wrist slot
   - Client checks if item has attribute 22 ("REPLACES HAND WHEN WORN")
   - **Client validates user has required achievements**
   - If validation passes, sends attachment data to server
   - Client renders hand replacement (hides original hand, shows item)

2. **Server-Side:**
   - Receives attachment data for slot 6 or 7
   - Stores attachment data in account.json
   - Returns success response
   - **No special handling needed for hand replacements**

3. **Thing Definition:**
   - Hand replacement items have `"a": [22, ...]` in their thingdef
   - Attribute 22 signals "REPLACES HAND WHEN WORN"
   - Client reads this attribute from ThingDefs server
   - Client applies visual effect based on attribute

### System Components

```
Client                    API Server (8000)         ThingDefs Server (8001)
  |                             |                            |
  |-- POST /auth/start -------->|                            |
  |<-- achievements array -------|                            |
  |                             |                            |
  |-- GET /thingId -------------|--------------------------->|
  |<-- thingdef with a:[22] ----|----------------------------|
  |                             |                            |
  |-- Validate achievements --->|                            |
  |-- POST /person/updateattachment ->|                      |
  |<-- {ok: true} ---------------|                            |
  |                             |                            |
  |-- Render hand replacement ->|                            |
```

## Lessons Learned

1. **Client-side validation exists** - Not all features are purely server-controlled
2. **Achievement systems gate features** - Even in read-only archives
3. **Exact API compatibility matters** - Small differences in response fields can break features
4. **Compare with working implementations** - Redux server provided crucial reference
5. **User insights are valuable** - User's theory about person info was correct

## Future Considerations

### Potential Enhancements

1. **Achievement system implementation** - Track real achievements rather than granting all
2. **Progressive unlocking** - Gate features behind actual gameplay progression
3. **Custom achievement sets** - Allow server admins to configure which achievements to grant
4. **Account migration** - Import achievements from original Anyland accounts

### Known Limitations

1. All users currently receive full achievement set by default
2. No actual achievement tracking or progression system
3. Achievement IDs are hardcoded from Redux server snapshot

## Conclusion

The hand replacement feature failure was caused by an empty achievements array in the authentication response. The client's capability validation system requires a populated achievements array to unlock advanced features like hand replacement. 

The fix was simple but non-obvious: populate the achievements array with default values matching the reference implementation. This demonstrates the importance of exact API compatibility when implementing server replacements for proprietary client software.

**Time to Resolution:** Multiple iterations over several hours  
**Lines of Code Changed:** ~30 lines  
**Impact:** Critical feature now functional for all users

---

**Document Version:** 1.0  
**Date:** October 19, 2025  
**Author:** AI Assistant (Claude)  
**Reviewed By:** User (Echoland Developer)

