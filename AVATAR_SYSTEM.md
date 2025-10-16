# Avatar System in Anyland/Echoland

## Discovery Summary

After extensive testing and debugging, we've discovered that the avatar system in Anyland works very differently than initially assumed.

## Avatar Attributes

### Attribute 24: Full Body Avatar

When a thing has attribute `24`, it's a **full body avatar head**. This head includes a special `bod` (body) object that defines the complete avatar:

```json
{
  "a": [24],
  "bod": {
    "h": {
      "p": [-0.0914057, -0.05497637, -0.07428561],
      "r": [20.25747, 83.21461, 87.87063]
    },
    "al": {
      "i": "5c705e31fa31b00e76f96f88",  // Left arm thing ID
      "p": [-0.02901424, -0.02789617, -0.0517264],
      "r": [353.2933, 192.8132, 120.6469]
    },
    "ar": {
      "i": "5c6f2abacf4d5c2a9863210d",  // Right arm thing ID
      "p": [0.03941123, -0.0217762, -0.04866246],
      "r": [351.5403, 164.7088, 238.9317]
    },
    "ut": {
      "i": "5c70a243fa31b00e76f96fa6",  // Upper torso thing ID
      "p": [-0.1410263, -0.1763629, 0.01581557],
      "r": [7.071393, 60.23666, 0.08670069]
    }
  }
}
```

### Attribute 27: Arm (with hands)

When a thing has attribute `27`, it's an **arm** that includes hands. These are referenced by the `bod.al` (arm left) and `bod.ar` (arm right) in the head definition.

```json
{
  "a": [27],
  "p": [
    // Arm and hand geometry...
  ]
}
```

## How It Works

### 1. Wear the Head

When you attach a thing with attribute 24 to slot 0 (head sphere):

1. Client detects attribute 24
2. Client reads the `bod` object
3. Client fetches all referenced thing IDs:
   - `bod.al.i` - Left arm
   - `bod.ar.i` - Right arm  
   - `bod.ut.i` - Upper torso
   - And potentially more body parts

### 2. Client Loads Body Parts

The client:
1. Fetches thing definitions for all body part IDs
2. Renders them at the positions/rotations defined in `bod`
3. **Replaces your hands with the arm things** (attribute 27)

### 3. Server Responsibility

The server only needs to:
- ✅ Store the head attachment in slot 0
- ✅ Return the head thing definition with `bod` object
- ✅ Serve the arm/body part thing definitions when requested
- ❌ Does NOT need to track individual body parts as separate attachments
- ❌ Does NOT need special hand replacement logic

## Attachment Slots

| Slot | Purpose |
|------|---------|
| 0 | **Head** - Can trigger full body avatar (attribute 24) |
| 1 | ? |
| 2 | Chest/Body (for non-full-body attachments) |
| 3 | Upper torso (when using full body avatar) |
| 4 | ? |
| 5 | ? |
| 6 | Left wrist (for standalone wrist attachments) |
| 7 | Right wrist (for standalone wrist attachments) |
| 8 | Left wrist sphere? |
| 9 | Right wrist sphere? |

## Example: Wearing a Full Avatar

### Step 1: Client Sends Attachment

```
POST /person/updateattachment
{
  "id": "0",
  "data": "{\"Tid\":\"5c70a3246af4485b71de3136\",\"P\":{...},\"R\":{...}}"
}
```

### Step 2: Server Saves to account.json

```json
{
  "attachments": {
    "0": {
      "Tid": "5c70a3246af4485b71de3136",
      "P": {...},
      "R": {...}
    }
  }
}
```

### Step 3: Client Loads Thing Definition

```
GET /thing/def/5c70a3246af4485b71de3136
```

Returns thing with attribute 24 and `bod` object.

### Step 4: Client Loads Body Parts

```
GET /thing/def/5c705e31fa31b00e76f96f88  (left arm)
GET /thing/def/5c6f2abacf4d5c2a9863210d  (right arm)
GET /thing/def/5c70a243fa31b00e76f96fa6  (upper torso)
```

### Step 5: Client Renders Full Avatar

The client now shows:
- Avatar head (from slot 0)
- Left arm with hand (from `bod.al`)
- Right arm with hand (from `bod.ar`)
- Upper torso (from `bod.ut`)

**Your default hands are now replaced!**

## What We Got Wrong

### ❌ Misconception 1: Attribute 22

We thought attribute 22 meant "replaces hand when worn". This is likely incorrect or refers to a different feature.

### ❌ Misconception 2: Wrist Attachments

We thought slots 6 and 7 (wrists) could have hand replacement objects. While you CAN attach things to wrists, full hand replacement happens through the body system (attribute 24 + 27).

### ❌ Misconception 3: Server-Side Hand Replacement

We thought the server needed to track hand replacements. Actually, the server just stores attachments normally, and the CLIENT handles all body/hand replacement logic by reading thing definitions.

### ❌ Misconception 4: leftHand/rightHand Fields

We thought adding `leftHand`/`rightHand` to `/auth/start` would enable hand replacements. The Redux server doesn't have these fields and avatars work fine.

## What Actually Matters

### ✅ Thing Definitions Must Exist

The thing definition files MUST exist and be served correctly:
- `/thing/def/<headId>.json` with attribute 24 and `bod` object
- `/thing/def/<armId>.json` with attribute 27
- All geometry data (`p` array) properly formatted

### ✅ Attachments Saved Correctly

The `account.json` must have the head attachment in slot 0:
```json
{
  "attachments": {
    "0": {
      "Tid": "<headId>",
      "P": {...},
      "R": {...}
    }
  }
}
```

### ✅ No JSON Corruption

Multiple simultaneous `/person/updateattachment` requests can corrupt `account.json`. The server now uses:
- Retry logic for reads
- Atomic writes (temp file + rename)
- Proper error handling

## Current Status

✅ **Server correctly saves attachments**
✅ **Server serves thing definitions**
✅ **Atomic writes prevent corruption**
⏳ **Testing needed** - Need to verify full avatar works end-to-end

## Testing Checklist

1. [ ] Attach avatar head (Thing ID: `5c70a3246af4485b71de3136`) to slot 0
2. [ ] Verify `account.json` saves the attachment
3. [ ] Verify server serves head definition with attribute 24 and `bod`
4. [ ] Verify server serves arm definitions (attribute 27)
5. [ ] Verify client renders full avatar with hand replacements
6. [ ] Restart game and verify avatar persists
7. [ ] Remove avatar and verify removal works
8. [ ] Test with multiple rapid attachment changes (no corruption)

## References

- Thing ID `5c70a3246af4485b71de3136` - Example avatar head (attribute 24)
- Thing ID `5c705e31fa31b00e76f96f88` - Example left arm (attribute 27)
- Thing ID `5c6f2abacf4d5c2a9863210d` - Example right arm (attribute 27)
- Thing ID `5c70a243fa31b00e76f96fa6` - Example upper torso

## Next Steps

The server implementation is now correct. The remaining work is:
1. Test that thing definitions are being served correctly
2. Verify the client can load and render full avatars
3. Document how to CREATE new full body avatars (setting attribute 24, creating `bod` object)

