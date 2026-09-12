/** BE-APR-EXEC-06 — Diceware-style 4-word confirmation phrases (high_value only). */

import { createHash, randomUUID } from 'node:crypto'

export const DICEWARE_WORDS = Object.freeze(`
acid acorn acre acts afar affix aged agent agile aging agony ahead aide aids aim ajar
alarm album alert algae alibi alien alike alive alley alloy alone aloft alpha amber
amend amino amiss ammo amuse angel anger angle angry ankle annex annoy anvil apart
apron aptly aroma arose array arrow arson ashen ashes aside askew atlas atom atone
attic audio audit augur avian avoid await awake award aware awash awful awoke axial
axiom azure babel bacon badge badly bagel baggy baked baker balmy banjo barge baron
basal basic basil basin basis batch baton beach beard beast beige belly below bench
berry birch birth bison black blade blame bland blank blast blaze bleak blend bless
blind bliss block blond blood bloom board boast bonus boost booth bound brain brake
brand brass brave bread break breed brick bride brief bring brisk broad broke brood
brook broom broth brown brush brute buddy build built bunch cabin cable cactus cafe
cage cake calm camel camp canal candy canoe canvas cape carbon card cargo carol
carry carve case cash catch cater cause cedar chain chair chalk champ chant chaos
charm chart chase cheap check cheek cheer chess chest chick chief child chili chill
chime chin chip choir choke chord chore chose chuck churn cider cigar cinch circa
civic civil claim clamp clang clash clasp class clean clear cleat clerk click cliff
climb cling clip cloak clock clone close cloth cloud clout clove clown cluck clump
clung coach coast cobra cocoa code coil coin cola cold colon color comet comic
comma conch coral cork corn cost couch cough could count coupe court cover crack
craft crane crank crash crate crave crawl crazy cream credo creed creek creep crest
cried crime crisp croak crook cross crowd crown crude cruel crush crust crypt cubic
cuddle cumin cupid curly curry curse curve cyber cycle cynic daisy dance dandy
datum dealt death debit debug debut decal decay decor decoy defer deity delay delta
delve demon denim dense depot depth derby deter detox devil diary dice digit diner
dingo dirty disco ditch ditch diver dizzy dodge dogma doing donor donut doubt dough
dozen draft drain drama drank drape drawl drawn dread dream dress dried drift drill
drink drive drone droop drove drown drunk dryer eager eagle early earth easel ebony
edict eerie eight eject elate elbow elder elect elegy elite elope elude email embed
ember empty enact endow enemy enjoy ensue enter entry envoy epoch equal equip erase
erect erode error erupt essay ether ethic ethos evade event every evict evoke exact
exalt excel exert exile exist expel extra exude exult fable facet faint fairy faith
false fancy farce fatal fault fauna favor feast fever fiber field fiend fiery fifth
fifty fight final finch finer first fishy fixer fizzy flack flail flair flake flaky
flame flank flare flash flask fleck fleet flesh flick flier fling flint flirt float
flock flood floor flora floss flour fluff fluid fluke flush flute flyer foam focal
focus foggy folio force forge forgo forte forth forty forum found foyer frail frame
frank fraud freak freed freer fried frill frisk frock front frost froth frown froze
fruit fudge fully fungi funky funny furor furry fussy fuzzy gaffe gaily gamer gamma
gauge gaunt gauze gavel gawky gazer gecko genie genre ghost giant giddy giraffe
girly girth given giver glade gland glare glass glaze gleam glean glide glint gloat
globe gloom glory gloss glove glyph gnome godly going golem golly goose gorge gouge
gourd grace grade graft grail grain grand grant grape graph grasp grass grate grave
gravy graze great greed green greet grief grill grime grimy grind gripe groan groin
groom grope gross group grove growl grown gruel gruff grunt guard guava guess guest
guide guild guile guilt guise gulch gully gumbo gummy gusto gusty habit hairy halve
handy happy hardy harsh haste hasty hatch haunt haven havoc hazel heady heard heart
heath heave heavy hedge hefty heist helix hello hence heron hilly hinge hippo hitch
hoard hobby hoist holly honey honor horde horse hotel hound house hover howdy human
humid humor hunch hurry husky hutch hydro hyper icing ideal idiom idiot idle igloo
image imbue impel imply inane inbox incur index inept inert infer ingot inlet inner
input inter intro ionic irate irony islet issue itchy ivory jaunty jelly jerky jewel
joint joker jolly joust judge juice juicy jumbo jumpy junta juror karma kayak kebab
khaki kiosk kitty knack knead knife knock knoll known koala label labor laden ladle
lager lance lanky lapel lapse large larva lasso latch later lathe latte laugh layer
leaky learn lease leash least leave ledge legal lemon level lever light liken lilac
limbo limit linen liner lingo lipid lithe liver livid llama lobby local locus lodge
lofty logic login loose loser louse lover lower lowly loyal lucid lucky lumen lumpy
lunar lunch lunge lupus lurch lurid lusty lying lymph lyric macaw macho macro madam
mafia magic magma maize major maker mambo manga mango mania manic manor maple march
marry marsh mason match matey mauve maxim maybe mayor meaty medal media medic melee
melon mercy merge merit merry metal meter metro micro midst might milky mimic mince
miner minor minty minus mirth miser mocha modal model modem mogul moist molar moldy
money month moody moose moral morph motel motif motor motto mound mount mourn mouse
mouth mover movie mower muddy mulch mummy munch mural murky mushy music musky musty
nadir naive nanny nasal nasty natal naval navel needy nerve never newer newly nicer
niche niece night ninja ninth noble noise noisy nomad noose north notch noted novel
nudge nurse nutty nylon nymph oaken obese occur ocean octal octet oddly offer often
olden older olive omega onion onset opera opium optic orbit order organ other otter
ought ounce outer ovary overt owing owner oxide ozone pagan pager paint panel panic
paper parse party pasta paste patch patio pause peace peach pearl pecan pedal penne
penny perch peril perky pesky pesto petal petty phase phone photo piano piece piety
pilot pinch pinky piper pitch pithy pivot pixel pizza place plaid plain plane plank
plant plate plaza plead pleat pluck plumb plume plump plush point poise poker polar
polka porch poser posit pound power prank prawn press price prick pride prime print
prior prism privy prize probe prone prong proof prose proud prove proxy prune psalm
pulpy pulse punch pupil puppy puree purge purse pushy putty quack quail quake qualm
quart quasi queen query quest queue quick quiet quilt quirk quite quota quote rabbi
rabid racer radar radio rainy raise rally ranch rapid rarer raspy ratio raven razor
reach react ready realm rebel rebus rebut recap recur refer regal rehab reign relax
relay relic remit renew repay repel reply reset resin retro retry reuse revel rhino
rhyme rider ridge rifle right rigid rigor rinse ripen risen risky rival river rivet
roach roast robin robot rocky rodeo roger rogue roomy roost rotor rouge rough round
rouse route rover rowdy rower royal ruddy rugby ruler rumor rural rusty sadly safer
saint salad salon salsa salty salve sandy sappy satin sauce saucy sauna savor savvy
scale scalp scaly scant scare scarf scary scene scent scoff scold scoop scope score
scorn scour scout scrap screw scrub scuba sedan seize sense sepia serif serum serve
setup seven sever sewer shack shade shady shaft shake shaky shale shall shame shape
share shark sharp shave shawl shear sheep sheer sheet shelf shell shift shine shiny
shirt shock shook shoot shore short shout shove shown showy shrug shush shyly sibling
sigma silky silly since singer siren sixth sixty skate skier skiff skill skirt skulk
skull skunk slack slain slang slant slash slate slave sleek sleep sleet slept slice
slick slide slime slimy sling slink slope slosh sloth slump slung slurp slyly smack
small smart smash smear smell smelt smile smirk smoke smoky snack snail snake snare
snarl sneak sneer snide sniff snipe snoop snore snort snout snowy snuck snuff soapy
sober soccer sonar sonic sooth sorry sound south space spade spare spark spasm spawn
speak spear speck speed spell spend spent sperm spice spicy spied spike spiky spill
spilt spine spicy spire spite splat split spoil spoke spoof spook spool spoon spore
sport spout spray spree sprig spunk spurn spurt squad squat stack staff stage stain
stair stake stale stalk stall stamp stand stare stark start stash state steak steal
steam steel steep steer stern stick stiff still sting stink stock stoic stole stomp
stone stony stood stool stoop store stork storm story stout stove strap straw stray
strip strut stuck study stuff stump stung stunt style suave sugar suite sulky sully
sunny super surge surly sushi swamp swarm swear sweat sweep sweet swell swept swift
swine swing swirl swish swoon swoop sword swore sworn swung syrup table taboo tacit
tacky taken taker tally talon tamer tango tangy taper tardy taste tasty taunt teach
tease teddy teeth tempo tenet tenor tense tenth terra terse testy thank theft their
theme there these thick thief thigh thing think third thorn those three threw throb
throw thumb thump thyme tiara tidal tiger tight tilde timer timid tipsy titan title
toast today toddy token tonal toner tonic tooth topaz topic torch torso total totem
touch tough towel tower toxic toxin trace track tract trade trail train trait tramp
trash trawl tread treat trend triad trial tribe trick tried tripe troll troop trope
trout trove truce truck truer truly trump trunk truss trust truth tubal tulip tumor
tunic turbo tutor twang tweak tweet twice twine twirl twist tying ulcer ultra uncle
uncut under undid undue unfit unify union unite unity unmet until unzip upper upset
urban usage usher using usual usurp utter vague valet valid valor value valve vapor
vault vegan venom venue verge verse verve vicar video vigil vigor villa vinyl viola
viper viral virus visit visor vista vital vivid vocal vodka vogue voice vomit voter
vouch vowel wacky wafer wager wagon waist waive waltz waste watch water waver weary
weave wedge weigh weird whack whale wharf wheat wheel where which while whirl whisk
white whole whose widen wider widow width wield wince winch windy wiser wispy witch
witty woken woman women woody woozy wordy world worry worse worst worth would wound
woven wrack wrath wreck wring wrist write wrong wrote wrung yacht yearn yeast yield
young youth zebra zesty zonal lantern quiet copper drift
`.trim().split(/\s+/))

function pickWord(seedHex, index) {
  const slice = seedHex.slice(index * 8, index * 8 + 8)
  const n = Number.parseInt(slice || '0', 16)
  return DICEWARE_WORDS[n % DICEWARE_WORDS.length]
}

export function generateConfirmationPhrase({ requestId, attempt, salt = randomUUID() }) {
  const digest = createHash('sha256')
    .update(`${requestId}:${attempt}:${salt}`)
    .digest('hex')
  return [0, 1, 2, 3].map((i) => pickWord(digest, i)).join('-')
}

export function phrasesMatch(expected, provided) {
  if (expected == null || provided == null) return false
  return String(expected).trim() === String(provided).trim()
}

export async function issueConfirmationPhrase(client, {
  requestId, now, currentAttempt = 0,
}) {
  const nextAttempt = Number(currentAttempt || 0) + 1
  const phrase = generateConfirmationPhrase({ requestId, attempt: nextAttempt })

  await client.query(
    `UPDATE fin.approval_confirmation_phrases
        SET retired_at = $2
      WHERE request_id = $1 AND consumed_at IS NULL AND retired_at IS NULL`,
    [requestId, now],
  )
  await client.query(
    `INSERT INTO fin.approval_confirmation_phrases (
       id, request_id, attempt_number, phrase, created_at
     ) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), requestId, nextAttempt, phrase, now],
  )
  await client.query(
    `UPDATE fin.approval_requests
        SET execute_attempt = $2,
            confirmation_phrase = $3,
            confirmation_phrase_created_at = $4,
            updated_at = $4
      WHERE id = $1`,
    [requestId, nextAttempt, phrase, now],
  )
  return { phrase, attempt: nextAttempt }
}

export async function consumeConfirmationPhrase(client, { requestId, phrase, now }) {
  await client.query(
    `UPDATE fin.approval_confirmation_phrases
        SET consumed_at = $3
      WHERE request_id = $1 AND phrase = $2 AND consumed_at IS NULL`,
    [requestId, phrase, now],
  )
  await client.query(
    `UPDATE fin.approval_requests
        SET confirmation_phrase = NULL,
            confirmation_phrase_created_at = NULL,
            updated_at = $2
      WHERE id = $1`,
    [requestId, now],
  )
}
