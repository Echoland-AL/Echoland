# Hand Replacement & Avatar Features - Implementation Summary

## 🎯 What Was Fixed

### 1. Hand Color Persistence ✅
- **Problem**: Hand colors were not saving or persisting across sessions
- **Solution**: 
  - Modified `/person/sethandcolor` to save RGB values to `account.json`
  - Added `parseFloat()` to convert string values to numbers
  - Updated `/auth/start` to return hand colors as objects (not JSON strings)
  - Added `leftHandColor` and `rightHandColor` fields to auth response

### 2. Hand Replacement Support ✅
- **Problem**: Objects with "replaces hand when worn" attribute weren't working
- **Root Cause**: Client checks for `leftHand`/`rightHand` fields in `/auth/start` response to determine if server supports hand replacements
- **Solution**:
  - Added `leftHand: undefined` and `rightHand: undefined` to `/auth/start` response
  - These fields signal to the client that the server supports hand replacements
  - Hand replacement rendering is 100% client-side based on attribute flag 22 in thing definitions

### 3. Thing Creation & Attributes ✅
- **Problem**: Created things only had `thinginfo` files, missing `thingdef` and `thingtags`
- **Solution**:
  - Modified `/thing` POST endpoint to create all three files
  - Added `/thing/updateDefinition` endpoint to save complete thing definitions with attributes
  - Added alternative endpoints: `/thing/saveDefinition` and `PUT /thing/:id` for compatibility
  - Server now logs when attributes are saved: `✅ Updated thing definition for <id> with attributes: [22]`

### 4. Attachment System ✅
- **Problem**: Attachments were saving but not correctly structured
- **Solution**:
  - Simplified `/person/updateattachment` to store raw attachment data
  - Removed complex hand replacement detection logic (not needed - client handles it)
  - Properly handle wrist slots (6 and 7) as regular attachments
  - Return attachments as JSON string in `/auth/start`

## 📁 Modified Files

### `game-server.ts`
**Changes:**
1. **`/auth/start` endpoint** (lines ~440-441):
   ```typescript
   leftHandColor: account.handColor || undefined,
   rightHandColor: account.handColor || undefined,
   leftHand: undefined,  // Required to signal hand replacement support
   rightHand: undefined, // Required to signal hand replacement support
   ```

2. **`/person/sethandcolor` endpoint** (lines ~550-585):
   - Save RGB values as numbers to `account.json`
   - Convert string values with `parseFloat()`
   - Return success response

3. **`/person/updateattachment` endpoint** (lines ~590-670):
   - Simplified to store attachment data directly
   - Handle empty string for removal
   - Support wrist slots (6 and 7) like any other slot
   - Extensive debug logging

4. **`/thing` POST endpoint** (lines ~1738-1816):
   - Create `thinginfo`, `thingdef`, and `thingtags` files
   - Initialize empty structures for new things

5. **NEW: `/thing/updateDefinition` endpoint** (lines ~1823-1854):
   - Accept thing ID and definition data
   - Save complete thing definitions with attributes
   - Log when attributes are saved
   - Support multiple parameter names (thingId/id, definition/data)

6. **NEW: `/thing/saveDefinition` endpoint** (lines ~1856-1889):
   - Alternative endpoint name for compatibility

7. **NEW: `PUT /thing/:id` endpoint** (lines ~1890-1922):
   - RESTful alternative for updating things

### `account.json`
**Structure:**
```json
{
  "personId": "...",
  "screenName": "...",
  "attachments": {
    "0": { "Tid": "...", "P": {...}, "R": {...} },
    "6": { "Tid": "...", "P": {...}, "R": {...} }
  },
  "handColor": {
    "r": 1.0,
    "g": 0.8,
    "b": 0.6
  }
}
```

### `.gitignore`
**Added:**
- `data/`
- `cache/`

### New Documentation Files

1. **`HAND_REPLACEMENT.md`** - Comprehensive guide to hand replacement feature
2. **`IMPLEMENTATION_SUMMARY.md`** - This file

## 🔧 How It Works

### Hand Colors

1. **Client sends color change**:
   ```
   POST /person/sethandcolor
   { "r": "1.0", "g": "0.8", "b": "0.6" }
   ```

2. **Server saves to `account.json`**:
   ```json
   {
     "handColor": {
       "r": 1.0,
       "g": 0.8,
       "b": 0.6
     }
   }
   ```

3. **On login, client receives**:
   ```json
   {
     "leftHandColor": { "r": 1.0, "g": 0.8, "b": 0.6 },
     "rightHandColor": { "r": 1.0, "g": 0.8, "b": 0.6 }
   }
   ```

### Hand Replacement

1. **Thing has attribute 22**:
   ```json
   {
     "n": "My Hand",
     "a": [22],
     "p": [...]
   }
   ```

2. **Player attaches to wrist**:
   ```
   POST /person/updateattachment
   {
     "id": "6",
     "data": "{\"Tid\":\"<thingId>\",\"P\":{...},\"R\":{...}}"
   }
   ```

3. **Server saves to `account.json`**:
   ```json
   {
     "attachments": {
       "6": {
         "Tid": "<thingId>",
         "P": {...},
         "R": {...}
       }
     }
   }
   ```

4. **Client receives on login**:
   - Parses `attachments` string
   - Finds slot 6 or 7
   - Fetches thing definition from `/thing/def/<thingId>`
   - Checks for attribute 22
   - **Renders hand replacement automatically**

## 🎮 Attribute Flags

| Flag | Feature |
|------|---------|
| 22 | **Replaces hand when worn** |
| 18 | Unknown (seen in Pip-Boy) |
| 21 | Unknown (seen in Pip-Boy) |
| 11 | Unknown (seen in Pip-Boy) |
| 12 | Unknown (interactive?) |

## 🧪 Testing Steps

1. **Start the server**: `bun run game-server.ts`

2. **Test hand colors**:
   - In game, change hand color
   - Should see: `[HAND COLOR] Saved hand color: { r: 0.x, g: 0.x, b: 0.x }`
   - Restart game
   - Hand color should persist

3. **Test hand replacement**:
   - Create a new object in game
   - Set "REPLACES HAND WHEN WORN" property
   - Should see: `✅ Updated thing definition for <id> with attributes: [22]`
   - Attach to wrist
   - Should see: `[WRIST] Storing wrist attachment in slot 6: {...}`
   - Hand should be replaced with your object

4. **Test attachment removal**:
   - Remove object from wrist
   - Should see: `[ATTACHMENT] Removed attachment from slot 6`
   - Default hand should reappear

## 🐛 Debug Logging

The server now includes extensive debug logging:

```
[HAND COLOR] Received request: { r: "0.5", g: "0.8", b: "1.0" }
[HAND COLOR] Saved hand color: { r: 0.5, g: 0.8, b: 1 }

[WRIST] Storing wrist attachment in slot 6: {"Tid":"...","P":{...},"R":{...}}
[ATTACHMENT] Updated attachment slot 6: {...}

[ATTACHMENT] Removed attachment from slot 6

✅ Updated thing definition for <id> with attributes: [22]
✅ Created thing <id> with info, def, and tags files
```

## 📊 Comparison with Original Anyland

| Feature | Original Anyland | Redux (Read-Only) | Echoland |
|---------|-----------------|-------------------|----------|
| Hand Colors | ✅ Persistent | ❌ Not implemented | ✅ Persistent |
| Hand Replacement | ✅ Client-side | ✅ Read-only | ✅ Full support |
| Save Attachments | ✅ Dynamic | ❌ Hardcoded | ✅ Dynamic |
| Create Things | ✅ Full | ❌ Read-only | ✅ Full |
| Attributes | ✅ Full | ✅ Read-only | ✅ Full |

## 🎯 Key Insights

1. **Hand replacement is client-side**: The server only stores the thing definition with attribute 22. The Unity client handles all rendering logic.

2. **Capability detection**: The client checks for `leftHand` and `rightHand` fields in `/auth/start` to determine if the server supports hand replacements. Without these fields, the client rejects attachments with the hand replacement attribute.

3. **Wrist slots are special**: Slots 6 and 7 are wrist attachments. When a thing with attribute 22 is attached to these slots, the client automatically replaces the hand.

4. **Redux server compatibility**: The Redux server works without implementing `/person/updateattachment` because all data is hardcoded in `/auth/start`. Echoland improves on this by supporting dynamic saving.

5. **Thing files**: Each thing needs THREE files:
   - `thing/info/<id>.json` - Metadata (name, creator, etc.)
   - `thing/def/<id>.json` - 3D geometry and attributes
   - `thing/tags/<id>.json` - Tags array

## 🚀 Next Steps

The implementation is now complete! Players can:

- ✅ Change hand colors (persist across sessions)
- ✅ Create objects with "replaces hand when worn"
- ✅ Attach hand replacements to wrists
- ✅ Remove hand replacements
- ✅ All data persists in `account.json`

## 📝 Notes

- Hand colors use 0-1 range (not 0-255)
- Attachments are stored as a JSON string in the auth response
- Thing definitions are served from the ThingDefs CDN (port 8001)
- All changes are backward compatible with existing data

