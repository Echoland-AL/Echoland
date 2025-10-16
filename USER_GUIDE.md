# Hand Replacement & Avatar Customization - User Guide

## 🎨 Changing Your Hand Color

1. Open your avatar customization menu (varies by VR platform)
2. Find the "Hand Color" option
3. Adjust the RGB sliders to your desired color
4. The color will save automatically
5. **Your hand color will persist** when you log back in!

**Note**: Hand colors use a 0-1 range where:
- 0 = no color (black)
- 0.5 = half intensity
- 1 = full intensity (white)

Examples:
- Red hands: `R=1.0, G=0, B=0`
- Green hands: `R=0, G=1.0, B=0`
- Blue hands: `R=0, G=0, B=1.0`
- Purple hands: `R=0.8, G=0.2, B=1.0`
- Skin tone: `R=1.0, G=0.8, B=0.6`

## 🤚 Creating Hand Replacements

### What is Hand Replacement?

Hand replacement allows you to replace the default hand model with any 3D object you create. This could be:
- Robot hands
- Claws or paws
- Tools (hammer, sword, etc.)
- Futuristic gauntlets
- Cartoon gloves
- Anything you can imagine!

### How to Create a Hand Replacement

#### Step 1: Create the Object

1. Open the creation menu (laser menu or edit tools)
2. Select "Create New Thing"
3. Give it a name (e.g., "Robot Hand")
4. Start building your hand model using the shape tools

**Tips for designing hands:**
- Look at your default hand for size reference
- Position the hand so the wrist connects naturally
- Remember to design both left and right if you want matching hands
- Test the scale - hands that are too big or too small look strange!

#### Step 2: Add the Hand Replacement Attribute

1. While editing your object, open the **Properties** or **Attributes** menu
2. Find the option for **"REPLACES HAND WHEN WORN"**
3. Enable this checkbox/attribute
4. Save your object

**Important**: The server will now save your object with attribute flag 22, which tells the client to replace your hand when worn.

You should see in the server logs:
```
✅ Updated thing definition for <thingId> with attributes: [22]
```

#### Step 3: Wear Your Hand

1. Pick up your new hand object
2. Look at your wrist
3. You should see small spheres near your wrists - these are attachment points
4. Place the object on your **wrist sphere**
   - Left wrist = left hand replacement
   - Right wrist = right hand replacement
5. The object should snap to your wrist
6. **Your default hand will be replaced with your custom object!**

If you hear an error sound, make sure:
- The "REPLACES HAND WHEN WORN" attribute is enabled
- You're attaching to the wrist sphere (not the hand itself)
- The server is running correctly

#### Step 4: Adjust Position (Optional)

After attaching, you can fine-tune the position and rotation:

1. Grab the object again
2. Move and rotate it to the perfect position
3. Re-attach to the wrist sphere
4. The new position will be saved

**Tip**: The object's position is relative to your wrist, so slight adjustments can make a big difference in how natural it looks.

## 🧪 Testing Your Hands

### Quick Test

1. Create a simple cube with the hand replacement attribute
2. Color it bright red so it's easy to see
3. Attach it to your left wrist
4. Your left hand should disappear and be replaced with the red cube
5. Remove it - your default hand should reappear

### Advanced Test

1. Create a detailed hand model
2. Add multiple colors and shapes
3. Set the hand replacement attribute
4. Attach to both wrists
5. Test grabbing objects - the hand should function normally
6. Look in a mirror - does it look good?
7. Restart the game - your hands should persist!

## 🔧 Troubleshooting

### My hand colors don't save
- Check the server logs for `[HAND COLOR] Saved hand color`
- Make sure `account.json` has a `handColor` object
- Verify the server is running

### I get an error sound when attaching
- Make sure you enabled "REPLACES HAND WHEN WORN"
- Check that you're attaching to the **wrist sphere**, not just your hand
- Look for server logs showing `[WRIST] Storing wrist attachment`
- Restart the server if needed

### My hand looks weird
- Adjust the position and rotation
- Check the scale - try making it bigger or smaller
- Look at the default hand for reference size
- Remember to design from the wrist perspective

### My hands disappear after restarting
- Check server logs for `[ATTACHMENT] Updated attachment slot`
- Make sure `account.json` has your attachments saved
- Verify the thing definition file exists in `data/thing/def/`

### The hand is there but doesn't have the attribute
- Re-edit the object
- Make sure "REPLACES HAND WHEN WORN" is checked
- Save again
- Check server logs for `✅ Updated thing definition for <id> with attributes: [22]`

## 📚 Examples & Inspiration

### Simple Examples
1. **Glowing Orbs**: Create colorful spheres for a magic hand effect
2. **Tools**: Make a hammer or wrench that's always in your hand
3. **Claws**: Sharp, angular shapes for a creature hand

### Advanced Examples
1. **Pip-Boy**: The classic Fallout wrist computer (exists in the game data!)
2. **Robotic Arms**: Mechanical parts with moving segments
3. **Fantasy Gauntlets**: Armored gloves with gems and details
4. **Cartoon Hands**: Oversized, stylized hands like Mickey Mouse

### Design Tips

- **Match your avatar style**: If you have a robotic body, use robotic hands
- **Consider function**: Will you grab objects? Make sure the hand looks natural
- **Use colors wisely**: Too many colors can look messy
- **Test in-game**: What looks good in the editor might look different when worn
- **Ask for feedback**: Show other players and get their opinions!

## 🎯 Advanced: Editing Thing Definitions Manually

If you're comfortable editing JSON files, you can manually add the hand replacement attribute:

1. Find your thing ID in the server logs
2. Navigate to `data/thing/def/<thingId>.json`
3. Edit the file to add `"a": [22]`:

```json
{
  "n": "My Hand",
  "a": [22],
  "p": [
    {
      "t": 1,
      "s": [...]
    }
  ]
}
```

4. Save the file
5. Restart the server (or wait for hot-reload if enabled)
6. The attribute is now active!

**Warning**: Manual editing can break things if you make a syntax error. Always backup first!

## 🌟 Community Sharing

Once you create awesome hand replacements:

1. Share screenshots with the community
2. Export and share your thing definition files
3. Create tutorials for complex designs
4. Host workshops to teach others

The best hand replacements will become part of the Echoland culture!

## 🆘 Getting Help

If you're stuck:

1. Check the server logs for error messages
2. Read `HAND_REPLACEMENT.md` for technical details
3. Ask in the community Discord/forums
4. Check if others have created similar hands
5. Start with a simple design and work your way up

Happy creating! 🎨✨

