# Hand Replacement & Avatar Customization

## Overview

Echoland supports full avatar customization including hand replacement, a feature that allows objects to replace the default hand models when worn.

## How Hand Replacement Works

### Client-Side Rendering
Hand replacement is **100% client-side**. The server only stores the thing definition with attributes; the Unity client handles all rendering logic.

### Attribute Flags

Thing definitions in Anyland/Echoland use attribute flags to enable special behaviors:

- **Attribute 22**: "REPLACES HAND WHEN WORN"
- **Attribute 18**: Unknown (seen in Pip-Boy example)
- **Attribute 21**: Unknown (seen in Pip-Boy example)

### Thing Definition Format

```json
{
  "n": "My Custom Hand",
  "a": [22],
  "p": [
    {
      "t": 1,
      "s": [
        {
          "p": [0.1, 0.2, 0.3],
          "r": [0, 90, 0],
          "s": [0.5, 0.5, 0.5],
          "c": [1, 0.5, 0.8]
        }
      ]
    }
  ]
}
```

**Fields:**
- `n`: Name of the thing
- `a`: Array of attribute flags (22 = hand replacement)
- `p`: Array of parts/geometry data
  - `t`: Type
  - `s`: Shapes array
    - `p`: Position [x, y, z]
    - `r`: Rotation [x, y, z]
    - `s`: Scale [x, y, z]
    - `c`: Color [r, g, b] (0-1 range)

## Attachment Slots

Avatar attachments are stored in numbered slots:

| Slot | Location |
|------|----------|
| 0 | Head/Face |
| 1 | ? |
| 2 | Chest/Torso |
| 3 | ? |
| 4 | ? |
| 5 | ? |
| **6** | **Left Wrist (Hand)** |
| **7** | **Right Wrist (Hand)** |
| 8 | Left Wrist Sphere |
| 9 | Right Wrist Sphere |

## Hand Colors

Hand colors are stored separately from attachments:

```json
{
  "handColor": {
    "r": 1.0,
    "g": 0.8,
    "b": 0.6
  }
}
```

### API Endpoints

**Set Hand Color:**
```
POST /person/sethandcolor
{
  "r": "1.0",
  "g": "0.8", 
  "b": "0.6"
}
```

**Update Attachment:**
```
POST /person/updateattachment
{
  "id": "6",
  "data": "{\"Tid\":\"<thingId>\",\"P\":{\"x\":0,\"y\":0,\"z\":0},\"R\":{\"x\":0,\"y\":0,\"z\":0}}"
}
```

**Remove Attachment:**
```
POST /person/updateattachment
{
  "id": "6",
  "data": ""
}
```

## Server Implementation

### Key Files

1. **`/auth/start`** - Returns initial avatar data including:
   - `attachments`: JSON string with all attachment data
   - `leftHandColor`: Hand color object
   - `rightHandColor`: Hand color object
   - `leftHand`: Signals hand replacement support
   - `rightHand`: Signals hand replacement support

2. **`/person/updateattachment`** - Saves attachment data to `account.json`

3. **`/person/sethandcolor`** - Saves hand colors to `account.json`

4. **`/thing/updateDefinition`** - Saves thing definitions with attributes

### account.json Structure

```json
{
  "personId": "...",
  "screenName": "...",
  "attachments": {
    "0": {
      "Tid": "<thingId>",
      "P": { "x": 0, "y": 0, "z": 0 },
      "R": { "x": 0, "y": 0, "z": 0 }
    },
    "6": {
      "Tid": "<handReplacementThingId>",
      "P": { "x": -0.02, "y": -0.03, "z": -0.29 },
      "R": { "x": 8.8, "y": 24.1, "z": 223.6 }
    }
  },
  "handColor": {
    "r": 1.0,
    "g": 0.8,
    "b": 0.6
  }
}
```

## Creating Hand Replacement Objects

### In-Game Steps

1. **Create a new thing** - Use the building interface
2. **Design your hand** - Build the 3D model
3. **Set attributes** - Add attribute 22 via the thing properties dialog
4. **Save** - The server will save the definition with attributes
5. **Attach to wrist** - Wear the object on your left or right wrist

### Server Endpoints for Thing Creation

```
POST /thing
{
  "name": "My Hand"
}
```

Returns: `{ "id": "<thingId>" }`

Then update the definition:

```
POST /thing/updateDefinition
{
  "thingId": "<thingId>",
  "definition": {
    "n": "My Hand",
    "a": [22],
    "p": [...]
  }
}
```

## Debugging

### Server Logs

When hand replacements are saved, you'll see:
```
✅ Updated thing definition for <thingId> with attributes: [22]
[WRIST] Storing wrist attachment in slot 6: {...}
[ATTACHMENT] Updated attachment slot 6: {...}
```

### Common Issues

1. **Hand replacement doesn't work**
   - Check that attribute 22 is present in the thing definition
   - Verify the thing is attached to slot 6 or 7 (wrist)
   - Ensure `leftHand`/`rightHand` fields are present in `/auth/start` response

2. **Hand colors don't persist**
   - Check `account.json` has `handColor` object
   - Verify `/auth/start` returns `leftHandColor` and `rightHandColor`
   - Hand colors should be numbers (0-1), not strings

3. **Error sound when attaching**
   - Client detected missing hand replacement support
   - Make sure `leftHand` and `rightHand` fields exist in `/auth/start`

## Comparison with Redux Server

The Anyland Archive Redux server is **read-only** and doesn't implement `/person/updateattachment`. It works because:

1. All avatar data is hardcoded in `/auth/start`
2. Client tries to save but ignores 404 errors
3. On every login, client loads from the hardcoded string

Echoland improves on this by:

1. Supporting dynamic saving of attachments
2. Persisting hand colors across sessions
3. Allowing creation of new hand replacement objects
4. Providing multiple endpoint variants for compatibility

## Reference Example

See the Pip-Boy example from the original Anyland database:
- Thing ID: `58a25965b5fa68ae13841fb7`
- Attributes: `[22, 18, 21]`
- Worn on wrist (slot 6)

This object has full 3D geometry with interactive screens and demonstrates advanced hand replacement usage.

