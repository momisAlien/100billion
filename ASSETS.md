# Dealer artwork

Created using the built-in ImageGen tool, editing `dist/dealer.png` as the identity and composition reference. Final web assets: `dist/assets/dealer-*.webp` (1536 × 1024). WebP conversion changes encoding only; all poses are separately generated artwork, not mirrored images. Original generated PNGs remain in the ImageGen output folder. These are illustrated photographic poses with crossfade animation, not live video or a rigged 3D person.

## Shared generation prompt

Edit this reference. Keep EXACT same woman identity, facial proportions, tuxedo, hairstyle, background, lighting, camera, composition and table positions. Animation pose frame for a premium baccarat game; keep room and table precisely registered for smooth crossfading. Change ONLY arms hands gaze and facial expression as described. Photorealistic anatomically correct hands. No text, logos or UI.

## Pose prompts and events

- `idle`: Original reference, hands resting on the table. Waiting / return to neutral.
- `betting`: She warmly invites a bet: gently smiling, one open palm turned upward extending slightly toward the camera over the center felt, other hand resting on table. Subtle welcoming inclination of head. Chip selection / accepting bets / fresh session.
- `drawing`: She looks down toward viewer's right side of the table, her left arm reaches toward a discreet small black card shoe on far viewer-right edge of the table and her fingers draw a single face-down burgundy-backed card. Her right hand waits at center table. Natural professional dealer movement. Every card draw.
- `deal-player`: She is dealing one face-down burgundy-backed playing card to the PLAYER area on the VIEWER'S LEFT of the felt. Her right arm extended diagonally down to viewer-left, fingertips sliding a card across table, gaze following that card. Other hand resting near her torso. Professional focused expression.
- `deal-banker`: She is dealing one face-down burgundy-backed playing card to the BANKER area on the VIEWER'S RIGHT of the felt. Her left arm extended diagonally down to viewer-right, fingertips sliding a card across table, gaze following that card. Other hand resting near her torso. Professional focused expression.
- `win-player`: She announces PLAYER wins with an elegant celebratory smile and one open palm clearly presenting the VIEWER'S LEFT betting area. Her right arm extends toward viewer-left at table height, palm upward. Her other hand lightly rests near center. Slight gaze toward viewer-left. This is an announcement gesture, no cards in her hands.
- `win-banker`: She announces BANKER wins with an elegant celebratory smile and one open palm clearly presenting the VIEWER'S RIGHT betting area. Her left arm extends toward viewer-right at table height, palm upward. Her other hand lightly rests near center. Slight gaze toward viewer-right. This is an announcement gesture, no cards in her hands.
- `tie`: She announces TIE with both arms equally extended slightly outwards, BOTH palms open upward symmetrically over the felt, balanced neutral welcoming smile, head facing camera. Professional clear equal-result gesture. No cards in her hands.
- `closed`: She announces no more bets, both hands held forward just above the table with palms facing down, fingers gracefully extended, decisive calm expression, eyes facing camera. Both hands clearly visible, no cards.
- `collecting`: She is collecting the cards at the end of a round: looking down at the center table, both hands sweeping a small neat stack of burgundy-backed cards together near the center edge of the table. Composed gentle smile, professional gesture. Card cleanup / returning cancelled bets.

## Audio

Original Web Audio synthesis. Separate effects for chip selection, chip placement, cancellation, betting close, card draw, slide, flip, sweep, each winner, tie, payout, insufficient chips, and reset. Ambient harmony uses a separate lower-volume bus. No remote audio assets, recordings or credentials required.

Chip sounds now use original synthesized, damped composite-chip resonances in short staggered impacts, separate from card noise. Dealer speech uses browser/OS speech synthesis with user-selectable voices; no cloned voices or paid TTS service. Character selection is stored locally in the user's browser.


## Ten-character roster (built-in ImageGen)

Original Sophia plus nine fictional adult women. Final assets: `dist/assets/dealers/{yuna,elena,maya,rina,isabelle,aria,luna,valentina,chloe}.webp`. Each is a 1774 × 887 atlas encoded from the original generated PNG without cropping or image edits. CSS selects one cell from a four-column, three-row grid. First ten cells: idle, betting, drawing, deal-player, deal-banker, win-player, win-banker, tie, closed, collecting. Final two cells are unused duplicates. Discrete poses, not video.

Shared prompt: Create a photorealistic sprite atlas, exactly FOUR columns by THREE rows of equal landscape 3:2 cells, no gutters, borders, text or labels. The original dealer is a reference for room and camera style only. Each cell shows the same new fictional adult woman with consistent face, hair, clothing, stationary camera and background. Professional black tuxedo, white shirt, bowtie, fully clothed. Natural beautiful face and realistic skin. Luxury black and gold casino room and green felt. Centered head and visible upper body and hands. Generate the ten gestures above in row-major order, then idle and betting duplicates. No extra people.

Identity prompt variations:
- Yuna: Korean woman, 28, shoulder-length dark chocolate bob with soft side part, almond eyes, refined oval face, pearl earrings.
- Elena: European woman, 30, champagne blonde low ponytail, side-swept hair, blue-grey eyes, tiny gold earrings.
- Maya: woman, 29, warm brown skin, dark wavy hair pulled back, brown eyes, sculpted oval face, gold studs.
- Rina: Japanese woman, 28, jet-black chin-length bob with straight fringe, dark round eyes, rose lips, pearl earrings.
- Isabelle: woman, 31, copper-red low chignon and side curl, fair freckles, green eyes, long oval face.
- Aria: Black woman, 29, deep warm brown skin, sleek high bun, brown eyes, high cheekbones, gold earrings.
- Luna: Korean woman, 27, long dark brown high ponytail with airy wispy fringe, heart-shaped face, bright smile.
- Valentina: Latina woman, 30, olive skin, dark chestnut waves over one shoulder, amber-brown eyes, defined eyebrows, poised expression.
- Chloe: European woman, 28, short wavy honey-blonde bob, blue eyes, friendly smile.
