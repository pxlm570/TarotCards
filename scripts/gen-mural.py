# -*- coding: utf-8 -*-
"""夜城壁画皮肤生成管线（2026-08-19，用户三选确认：C1 叙事/D1 远景/E2 剪影嵌灯火）。

- 22 大牌：生图 edits 端点，每张以自己的游戏原画作「画风锚点」，构图按分配的模式重写
  （二次创作，非复刻）；护栏：与该牌原画的结构相似度须在 ±0.30（复制级≈+0.37），
  越界自动重生成一次；愚者复用已确认的 D1 样稿。
- 牌背：世界原画作锚点，对称星芒+剪影嵌灯火装置。
- 56 小牌：PIL 扁平壁画语言（近黑底+血红框+花色模版印双色）。
- key 走环境变量/.workbuddy/local-secrets.md；产物 500x839 webp。
"""
import base64
import hashlib
import io
import json
import math
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DECK = ROOT / "public" / "decks" / "night-mural"
ORIG = ROOT / "public" / "style-samples" / "orig"
SECRETS = ROOT / ".workbuddy" / "local-secrets.md"
API = "https://www.bytecatcode.org/v1/images/edits"
CARD_W, CARD_H = 500, 839
SIM_OK = 0.30

# 游戏编号 -> (应用id, 原画文件名)
ORIG_FILES = {
    1: "TarotCard_01_TheFool.png", 2: "TarotCard_02_TheMagician.png",
    3: "TarotCard_03_TheHighPriestess.png", 4: "TarotCard_04_TheEmpress.png",
    5: "TarotCard_05_TheEmperor.png", 6: "TarotCard_06_TheHierophant.png",
    7: "TarotCard_07_TheLovers.png", 8: "TarotCard_08_TheChariot.png",
    9: "TarotCard_09_Strength.png", 10: "TarotCard_10_TheHermit.png",
    11: "TarotCard_11_WheelOfFortune.png", 12: "TarotCard_12_Justice.png",
    13: "TarotCard_13_TheHangedMan.png", 14: "TarotCard_14_Death.png",
    15: "TarotCard_15_Temperance.png", 16: "TarotCard_16_TheDevil.png",
    17: "TarotCard_17_TheTower.png", 18: "TarotCard_18_TheStar.png",
    19: "TarotCard_19_TheMoon.png", 20: "TarotCard_20_TheSun.png",
    21: "TarotCard_21_Judgement.png", 22: "TarotCard_22_TheWorld.png",
    # 往日之影 DLC 四王（用户 2026-08-22 要求补全卡面，原画作锚点；
    # 源文件曾因下载命名事故带 .png.png 双扩展名，2026-08-24 已统一改为 .png）
    23: "Tarot_23_KingOfCups_CP2077PL.png",
    24: "Tarot_24_KingOfPentacles_CP2077PL.png",
    25: "Tarot_25_KingOfSwords_CP2077PL.png",
    26: "Tarot_26_KingOfWands_CP2077PL.png",
}

ANCHOR = (
    "Paint a NEW tarot card in EXACTLY the same art style, painting technique, flat color "
    "fields, dark limited palette and gritty spray-paint mural texture as the reference image. "
)
MODE = {
    "C1": ("Narrative scene: {subject} Keep the scene concept but completely change the "
           "viewing angle, pose details and layout - a fresh reinterpretation, not a copy. "),
    "D1": ("Distant high-angle city view: {subject} Seen from far away or high above, small "
           "figures against vast city scale. "),
    "E2": ("Symbolic silhouette device: {subject} Rendered as bold flat black silhouettes "
           "whose interiors are filled with tiny flat city lights, window grids and neon "
           "signs, against flat color fields and simple geometric shapes. "),
}
TAIL = ("Only the art style, palette and mood come from the reference. Absolutely no text "
        "of any kind - no letters, no numbers, no Roman numerals, no captions, no "
        "signatures, no watermarks.")

SUBJECTS = {  # 应用 major-NN -> (模式, 题材)
    "major-01": ("C1", "The Magician - a gold-jacketed skull-faced street conjurer behind a console table holding knives and a star-marked beverage can, an infinity symbol glowing below their chest, a wall of red masks behind them."),
    "major-02": ("C1", "The High Priestess - a seated enigmatic figure between two server-rack pillars, a veil of hanging cables behind her, a crescent hologram at her feet, a scroll of light in her lap, cool dark blues and deep reds."),
    "major-03": ("C1", "The Empress - a serene motherly figure crowned with neon flowers in a rooftop greenhouse, flowers in gradient from muted purple to reddish pink, two red skyscrapers against a pitch black sky above."),
    "major-04": ("C1", "The Emperor - a rigid corporate overlord seated on a throne of machinery, wires and dark glass, yellow background of stacked window grids, two ram-headed guardian drones at his sides."),
    "major-05": ("C1", "The Hierophant - a cyber-cult leader hovering cross-legged with a machine-like head and two bright red eyes, one hand raised in blessing, cracked buildings in blue and purple behind with smoke rising."),
    "major-06": ("C1", "The Lovers - two figures embracing on a rooftop, layered abstract background: dark orange field, a large yellow circle, a black triangle, small green and red flame buds at the bottom."),
    "major-07": ("D1", "The Chariot - an armored street-racer hunched over a hoverbike streaking through dark city streets far below, abstract dark purple background with light purple speed lines."),
    "major-08": ("C1", "Strength - a hooded feminine figure from chest up, face replaced by hollow criss-crossing metal beams with two red dot eyes, a deep blue tattoo of a woman prying open a wolf's jaws on her chest, dirty yellow corners."),
    "major-09": ("C1", "The Hermit - a lone hooded figure on a high fire escape holding up a lantern of pure light, seen from a respectful distance so the vast dark city spreads below, background gradient from deep red to brighter yellow, towers and support beams around."),
    "major-10": ("C1", "Wheel of Fortune - a giant eight-spoked wheel inscribed on a bullet-holed wall, surrounded by a ring of alchemical symbols and glyphs, two small figures reaching toward the wheel from below."),
    "major-11": ("C1", "Justice - a composed veiled woman between two purple towers with pipes and wires, holding a holographic balance scale in one hand and a sword of light in the other."),
    "major-12": ("C1", "The Hanged Man - a man suspended upside-down by one bound ankle from cables above the frame, serene halo of light around his head, four onlooking figures with single cybernetic eyes in bands of orange, brown and pink."),
    "major-13": ("C1", "Death - a left-facing cybernetic rider figure with a spiked metallic skull head and glowing yellow eyes, wires and cables streaming from the skull, flat light red background, a rose banner."),
    "major-14": ("C1", "Temperance - a seated cyborg man pouring liquid light between two chrome vessels, wearing a grey tank top marked with a black triangle inside a white square, calm rooftop scene."),
    "major-15": ("C1", "The Devil - a horned cybernetic face with many decorative red optic eyes arranged in a pattern, barred teeth in a hungry smile, deep blood red background, ornamental chains draped around."),
    "major-16": ("C1", "The Tower - a corporate tower struck by a huge lightning bolt, crown shattering into falling debris and fire, tiny figures plummeting, the dark city spreading below under a storm sky, seen from across the street so the whole tower fits the frame."),
    "major-17": ("C1", "The Star - a woman kneeling gracefully in a giant martini glass pouring water onto the ground, numerous shrouded onlookers with single purple eyes watching from the darkness, purple sparkles scattered like stars."),
    "major-18": ("C1", "The Moon - a huge moon with a serene face glowing over a mass city skyline, two wolves amid scrap metal and bones below, one howling upward, a pale path winding between them into darkness."),
    "major-19": ("C1", "The Sun - a white-clad cowgirl riding a golden motorcycle bathed in warm light, a radiant sun disc behind her, sunflowers with glowing centers along the bottom edge."),
    "major-20": ("C1", "Judgement - a cloaked skeletal trumpeter with dark wing shapes behind, sounding a long trumpet that beams light down onto figures rising from grave-like holes with arms outstretched."),
    "major-21": ("C1", "The World - a dancer wrapped in a wreath-oval of glowing circuit vines suspended above the city, one leg crossed behind the other, two light-wands held loosely, four neon glyphs glowing in the corners."),
}
BACK_SUBJECT = (
    "A perfectly symmetrical tarot card back emblem - a large eight-pointed star of wires and "
    "circuit traces at the center, surrounded by concentric rings of neon signs and alchemical "
    "glyphs, on a deep blood-red field, bold flat black shapes with tiny city lights."
)

# 往日之影四王：应用id -> (游戏编号, C1 题材)。
# 二稿策略（2026-08-22 用户反馈一稿与原画太相似）：不用各王自己的 PL 原画当参考图
# （edits 模式下模型会向参考构图靠拢），改用本套牌已确认的皇帝大牌作统一画风锚点，
# 构图完全由文字题材驱动；题材为夜城原创演绎，不复述原画特征。
# 花色主色与套牌小牌一致（SUIT_COLOR）。
KING_ANCHOR_NO = 4  # 皇帝：主题最贴（王座上的王者），已是用户确认过的成品
KING_MODE = (
    "Narrative scene: {subject} Invent the composition freely - do NOT imitate the "
    "reference image's layout, figures or symbols; take ONLY its painting style, "
    "texture and mood. "
)
# 评审记录（2026-08-22）：宝剑国王三稿定稿；圣杯国王三稿保留（另出 alt 备选待用户二选一）；
# 权杖国王二稿保留；星币国王三/四稿重绘（富商坐像两版被否，四稿改天台花园站立像）。
KING_SUBJECTS = {
    "cups-14": (23, (
        "The King of Cups - a silver-tongued river-king in layered robes of deep magenta "
        "silk and cables, seated on a floating throne of glass bottle-buoys and copper "
        "pipes on a dark canal, one hand raising a chalice that overflows with rosy light, "
        "golden robotic koi leaping in arcs around him, flat magentas and deep reds, red "
        "heart-lanterns reflected in the rippling water.")),
    "pentacles-14": (24, (
        "The King of Pentacles - a broad patient gardener-tycoon in a charcoal coat with "
        "gold chain epaulettes, standing proudly in a rooftop victory garden high above "
        "the night city, one arm cradling a huge golden pentacle like a harvested sun, "
        "the other hand resting on a bull-skull throne overgrown with grapevines and "
        "fiber optics, glowing coin-flowers in the planter rows, dark gold and warm black "
        "fields, towers with window-grid lights far below.")),
    "swords-14": (25, (
        "The King of Swords - a hawk-eyed strategist-king in a sharp violet coat with a "
        "collar of blades, enthroned on a stack of radar dishes and crossed girders high "
        "above a night highway, one great translucent sword held out sideways in calm "
        "judgment, white paper-moths and signal rings orbiting him, flat purples and cold "
        "greys, a grid of distant window lights far below.")),
    # 已获用户确认保留（2026-08-22 三稿评审），勿改题材
    "wands-14": (26, (
        "The King of Wands - a lion-hearted street-crew king in a blood-orange long coat "
        "with a crown of antenna shards, standing tall on a scaffolding throne, raising a "
        "staff wound with wires that sprouts a small living flame at the top, sparks and "
        "salamander glyphs at his feet, blood orange and flat black fields.")),
}

# 小牌 AI 全量题材（2026-08-22 样张确认后开始补全套）：
#  - 数字牌无原画参考，构图纯文字驱动，皇帝大牌锚定画风（同四王）
#  - 数量=牌义：数字牌一律「总数算术式 + 不得有其他」写法，生成后需人工过数
#  - 花色主色贯穿全组：权杖 血橙/黑（火+蝾螈）、圣杯 品红/深红（水+心灯+锦鲤）、
#    宝剑 紫/冷灰（风+纸蛾+信号环）、星币 暗金/暖黑（土+硬币花+藤蔓+公牛）
#  - 已定稿的 6 张样张标注「已定稿」，勿改题材
MINOR_SUBJECTS = {
    # ===== 权杖（fire）=====
    "wands-01": (  # 已定稿（丰碑式）
        "The Ace of Wands - a single colossal living wand sprouting from a cracked rooftop "
        "floor, wound with copper wires and blooming with a crown of small flames at the "
        "top, sparks drifting upward around it, blood orange and flat black fields, tiny "
        "salamander glyphs carved at its base."),
    "wands-02": (
        "The Two of Wands - a watchful crew boss in a blood-orange coat standing on a "
        "balcony, holding one small glowing globe of the city map, two tall living wands "
        "planted upright at the balcony's two corners, two wands in total, blood orange "
        "and flat black fields, the district's window-grid lights spreading below."),
    "wands-03": (
        "The Three of Wands - a planner in an orange windbreaker standing on a harbor "
        "crane watching three sky-ships depart into the dark, three tall masts with "
        "pennant flames in the foreground, three wands in total, blood orange and flat "
        "black fields."),
    "wands-04": (
        "The Four of Wands - a rooftop homecoming festival, four tall wands planted "
        "upright in a square and strung with garlands of festival lights and salamander "
        "banners, figures dancing between them, four wands in total, blood orange and "
        "flat black fields."),
    "wands-05": (
        "The Five of Wands - five rival street-crew youths sparring playfully on a "
        "rooftop court, five staffs in the scene, five in total and no other staves, "
        "sparks flying where they clash, blood orange and flat black fields."),
    "wands-06": (  # 五审：随行人数画不准，改「骑行持1+前景插立一排5」
        "The Six of Wands - a champion rider in a laurel crown on a hovering bike draped "
        "with a victory wreath, holding one laurel-wreathed wand high, and five pennant "
        "wands planted upright in a single row in the foreground, one plus five equals "
        "six wands in total and no other wands anywhere, a cheering crowd in the "
        "background, blood orange and flat black fields."),
    "wands-07": (
        "The Seven of Wands - one defiant defender atop a raised barricade of "
        "scaffolding, holding one staff against six staves raised toward him from below, "
        "seven staffs in total, sparks and grit flying, blood orange and flat black "
        "fields."),
    "wands-08": (  # 五审定稿候选B：屋顶插立两排各四（散飞/单列均数不准）
        "The Eight of Wands - eight living wands planted upright on a rooftop in two "
        "neat rows of four, two times four equals eight wands and no others, each "
        "sparking at the tip, the dark city and window lights behind, blood orange "
        "and flat black fields."),
    "wands-09": (
        "The Nine of Wands - a weary but unbroken sentry leaning on one staff atop a "
        "wall, eight more staffs planted upright as a palisade behind him, nine staffs "
        "in total, first light of dawn on the horizon, blood orange and flat black "
        "fields."),
    "wands-10": (  # 三审：一稿束内权杖超过 10，改两排各五可数
        "The Ten of Wands - a bent courier struggling up a night street under a heavy "
        "load of long staffs roped to his shoulder in two visible rows of five, two "
        "times five equals ten staffs in total and no others, a bright gate glowing in "
        "the distance ahead, blood orange and flat black fields."),
    "wands-11": (
        "The Page of Wands - an eager young explorer in an orange field jacket holding "
        "up one sparking staff like a torch, salamander glyphs stitched on his patches, "
        "standing before a wall of antennas, blood orange and flat black fields."),
    "wands-12": (
        "The Knight of Wands - a bold rider in a blood-orange long coat charging on a "
        "roaring hoverbike, one living staff raised like a lance and trailing flame, "
        "salamander pennants flying from the bike, sparks and dust, blood orange and "
        "flat black fields."),
    "wands-13": (  # 已定稿（宫廷配方·王后）
        "The Queen of Wands - a fierce festival queen in a blood-orange gown with a crown "
        "of small golden suns, seated confidently on a throne built from drum amps and "
        "stage trusses, one hand holding a living wand wreathed in flame, a black cat "
        "with antenna ears sitting at her feet, blood orange and flat black fields."),
    # ===== 圣杯（water）=====
    "cups-01": (
        "The Ace of Cups - a single ornate chalice held out of the darkness by a slender "
        "drone arm, overflowing with rosy light and five small heart-sparks, one chalice "
        "in total, flat magentas and deep reds, still canal water reflecting below."),
    "cups-02": (
        "The Two of Cups - two friends facing each other at a canal railing at night, "
        "each raising one glowing chalice in a toast, exactly two chalices, a "
        "heart-lantern glowing between them, flat magentas and deep reds."),
    "cups-03": (  # 已定稿（场景式）
        "The Three of Cups - three friends in night-market jackets dancing and toasting "
        "on a rooftop, three glowing magenta chalices raised high, flat magentas and deep "
        "reds, heart-lanterns strung between antenna towers behind them."),
    "cups-04": (
        "The Four of Cups - a bored figure sitting cross-legged on a rooftop with three "
        "glowing chalices set before them, ignoring a fourth chalice offered from above "
        "by a small drone, four chalices in total, flat magentas and deep reds."),
    "cups-05": (
        "The Five of Cups - a grieving figure in a long coat kneeling by a canal, three "
        "toppled chalices spilling fading rose light on the wet stones, two intact "
        "chalices still glowing upright on the ledge behind, five chalices in total, "
        "flat magentas and deep reds."),
    "cups-06": (  # 四审：三稿连人手持 8 杯，收紧为恰好六且封死其他
        "The Six of Cups - two children in a holo-arcade garden, each child holding "
        "exactly one small glowing chalice, and exactly four more chalices set on the "
        "carousel of memory behind them, one plus one plus four equals six chalices in "
        "total and no other cups anywhere in the image, soft nostalgia haze, flat "
        "magentas and deep reds."),
    "cups-07": (
        "The Seven of Cups - seven chalices floating in a ring of mist, each holding a "
        "different tiny hologram - a heart, a mask, a coin, a serpent, a tower, a star, "
        "a wreath - exactly seven chalices, a small figure gazing up from below, flat "
        "magentas and deep reds."),
    "cups-08": (  # 四审：三稿 9 杯，保留画面收紧为两排各四
        "The Eight of Cups - a lone figure with a staff walking away into river fog, "
        "exactly eight chalices stacked neatly on a rooftop shrine behind him in two "
        "rows of four, two times four equals eight chalices and no other cups anywhere, "
        "an eclipsed moon above, flat magentas and deep reds."),
    "cups-09": (  # 六审：用户定调保留店主手持一杯；架改 2x4 网格，手持 1+架上 8=9
        "The Nine of Cups - a content host seated proudly at a small night bar holding "
        "exactly one glowing chalice to his chest, and exactly eight more chalices "
        "standing on the back-bar shelf arranged in a grid of two rows of four, one "
        "plus eight equals nine chalices in total and no other cups anywhere in the "
        "image, heart-lanterns strung above, flat magentas and deep reds."),
    "cups-10": (  # 四审：三稿连边缘 12 杯，改左右各五
        "The Ten of Cups - a family of three silhouetted on a rooftop, exactly ten "
        "chalices strung like lanterns glowing in a great rainbow arc across the night "
        "sky, five chalices on the left half of the arc and five on the right half, "
        "five plus five equals ten and no other cups anywhere in the image, city towers "
        "far below, flat magentas and deep reds."),
    "cups-11": (  # 已定稿（宫廷配方·侍从）
        "The Page of Cups - a dreamy young courier in an oversized magenta jacket "
        "standing at a canal railing at night, holding out one ornate cup from which a "
        "small golden robotic fish leaps with a rolled message in its mouth, flat "
        "magentas and deep reds, heart-lanterns reflected in the dark water."),
    "cups-12": (
        "The Knight of Cups - a gentle dreamer in a magenta cloak riding a slow "
        "two-legged cargo walker, holding one overflowing chalice forward as an "
        "offering, a heart-lantern swaying from the walker's mast, river mist, flat "
        "magentas and deep reds."),
    "cups-13": (
        "The Queen of Cups - an empath queen in flowing magenta robes seated on a throne "
        "of whale-bone arches and glass buoys at the water's edge, holding one covered "
        "chalice crowned with a glowing scallop, golden koi circling in the dark water, "
        "flat magentas and deep reds."),
    # ===== 宝剑（air）=====
    "swords-01": (
        "The Ace of Swords - a single great blade of pure white light held upright at "
        "center, piercing through a crown of golden circuitry wreathed in olive cables, "
        "one blade in total, paper moths scattered by the wind of its light, flat "
        "purples and cold greys."),
    "swords-02": (
        "The Two of Swords - a blindfolded woman in a grey coat seated calmly before a "
        "dark sea of fog, arms crossed over her chest holding two long blades of pale "
        "light horizontally, exactly two blades, flat purples and cold greys."),
    "swords-03": (
        "The Three of Swords - three blades of pale light piercing a great "
        "heart-shaped metal sign in the rain, exactly three blades, rain streaks and "
        "distant towers, flat purples and cold greys."),
    "swords-04": (
        "The Four of Swords - a weary soldier sleeping peacefully on a chapel pew, "
        "three blades of light mounted on the wall above and one blade set flat beneath "
        "the pew, four blades in total, stained window light, flat purples and cold "
        "greys."),
    "swords-05": (
        "The Five of Swords - a smug duelist walking off with two blades of pale light "
        "over his shoulder while three more lie dropped on the rooftop court, five "
        "blades in total, two defeated figures retreating into the rain behind, flat "
        "purples and cold greys."),
    "swords-06": (
        "The Six of Swords - a ferryman poling a flat boat across dark water, six "
        "upright blades of pale light standing in the boat like passengers with one "
        "cloaked figure among them, exactly six blades, distant shore lights, flat "
        "purples and cold greys."),
    "swords-07": (  # 三审：一稿 6 剑，改算术式
        "The Seven of Swords - a cunning scout tiptoeing away from a night camp carrying "
        "an armful of five blades of pale light, five in his arms plus two blades left "
        "standing by the tents behind, five plus two equals seven blades in total, flat "
        "purples and cold greys."),
    "swords-08": (
        "The Eight of Swords - a blindfolded figure standing loosely bound by cables "
        "within a ring of eight blades of pale light planted upright around her, eight "
        "blades in total, a distant lit bridge, flat purples and cold greys."),
    "swords-09": (
        "The Nine of Swords - a sleepless figure sitting bolt upright in bed with face "
        "in hands, nine blades of pale light hanging in a neat three-by-three grid on "
        "the wall above, nine in total, a single small lamp, flat purples and cold "
        "greys."),
    "swords-10": (  # 已定稿（阵列式·候选A）
        "The Ten of Swords - exactly ten identical blades of pale light planted upright on "
        "an empty rooftop in two neat rows of five, five blades in each row, ten blades "
        "total and no other blades anywhere in the image, flat purples and cold greys, "
        "the first grey light of dawn on the horizon behind the towers."),
    "swords-11": (
        "The Page of Swords - an alert young cadet in a wind-blown grey coat standing "
        "on a rooftop ledge, holding one blade of pale light upright and studying the "
        "wind, paper moths circling him, distant storm clouds, flat purples and cold "
        "greys."),
    "swords-12": (
        "The Knight of Swords - a fierce rider charging forward on a roaring machine "
        "through wind and rain, one great blade of pale light raised high, his coat "
        "flying like wings, speed lines and debris, flat purples and cold greys."),
    "swords-13": (
        "The Queen of Swords - a stern clear-eyed queen in a violet coat seated high on "
        "a throne of girders and antennae, one blade of pale light raised upright in "
        "judgment, her other hand extended in calm command, white paper moths and "
        "signal rings around her, flat purples and cold greys."),
    # ===== 星币（earth）=====
    "pentacles-01": (
        "The Ace of Pentacles - a single huge golden pentacle like a rising sun above a "
        "garden gate on a rooftop, offered from the dark by a slender gantry crane arm, "
        "one pentacle in total, coin-vines climbing the gateposts, dark gold and warm "
        "black fields."),
    "pentacles-02": (
        "The Two of Pentacles - a street performer in patched gold-trimmed clothes "
        "juggling two glowing pentacles connected by an infinity loop of light, exactly "
        "two pentacles, ships and traffic loops in the harbor mist behind, dark gold "
        "and warm black fields."),
    "pentacles-03": (
        "The Three of Pentacles - a mural workshop scene: an architect holding a "
        "scroll, a mason robot lifting a panel, and an artisan carving, three golden "
        "pentacle seals glowing on the finished wall, three in total, dark gold and "
        "warm black fields."),
    "pentacles-04": (
        "The Four of Pentacles - a hoarder-baron seated before the city he owns, "
        "clutching one great golden pentacle to his chest, one pentacle balanced on his "
        "head like a crown, two pentacles under his boots, four in total, dark gold "
        "and warm black fields."),
    "pentacles-05": (  # 已定稿（叙事式）
        "The Five of Pentacles - two small ragged figures sheltering from the wind in a "
        "dark alley, above them a tall stained-glass window glowing with five golden "
        "pentacle lights, dark gold and warm black fields, ash drifting like snow through "
        "a beam of warm light."),
    "pentacles-06": (  # 四审：三稿仍 8 币，收紧计数来源（人/天平/手）并封死
        "The Six of Pentacles - a benefactor in a gold-lined coat at a clinic door "
        "handing exactly two golden pentacles down to two kneeling figures, and his "
        "hanging scale holds exactly four pentacles in its pans, two plus four equals "
        "six pentacles in the whole image and he carries no other coins, no coins "
        "anywhere else, ash falling like snow, dark gold and warm black fields."),
    "pentacles-07": (  # 八审：恢复五审A原始提示词（六/七轮加约束导致风格跑偏，用户点名回A）
        "The Seven of Pentacles - a patient rooftop farmer leaning on a long rake, "
        "gazing at a vine trained along a straight trellis rail bearing exactly seven "
        "golden coin-flowers in a single row, seven blossoms and no other coins "
        "anywhere in the image, the city's window-grid lights behind, dark gold and "
        "warm black fields."),
    # 星币8/9 换名（2026-08-22 用户裁定）：原 9 的葡萄园女王图（画有 8 枚）定名为 8；
    # 9 换珠宝店九宫格新题材；10 原画不理想，整卡重设计为传承树。
    "pentacles-08": (
        "The Eight of Pentacles - an independent vineyard queen in dark gold silk "
        "standing in her rooftop arbor, a drone-falcon perched on her glove, eight "
        "golden coin-grapes heavy on the vine, eight in total, dark gold and warm "
        "black fields."),
    "pentacles-09": (
        "The Nine of Pentacles - an elegant jeweler-queen in dark gold silk examining "
        "nine golden pentacles displayed upright on a boutique stand in a "
        "three-by-three grid, three times three equals nine pentacles in total, a "
        "small drone-falcon perched nearby, warm lamplight, dark gold and warm black "
        "fields."),
    "pentacles-10": (
        "The Ten of Pentacles - a great legacy tree growing through a rooftop "
        "courtyard, ten golden pentacles hanging from its branches like fruit in "
        "clear rows of four, four and two, four plus four plus two equals ten in "
        "total, three generations of a family - elder, parents, child - silhouetted "
        "beneath its canopy, dark gold and warm black fields."),
    "pentacles-11": (
        "The Page of Pentacles - a studious young treasurer in a patched coat holding "
        "one glowing golden pentacle up to the light with both hands, coin-vines and "
        "small tools at his belt, dark gold and warm black fields."),
    "pentacles-12": (
        "The Knight of Pentacles - a patient knight in a charcoal coat riding a slow "
        "heavy cargo mech along a night road, one golden pentacle set glowing in the "
        "mech's chest plate, harvest sacks strapped on, dark gold and warm black "
        "fields."),
    "pentacles-13": (
        "The Queen of Pentacles - a warm greenhouse queen in a dark gold gown seated "
        "on a throne entwined with coin-vines and grape leaves, one golden pentacle "
        "resting on her lap, a hare-drone with antenna ears at her side, dark gold and "
        "warm black fields."),
}

def gen_minor_samples(k):
    """小牌 AI 全量：输出 public/style-samples/minors/（本地，不入库），已有文件跳过。
    数字牌无原画不设护栏；皇帝大牌锚定画风；3 并发（neon 管线验证过的并发度）。"""
    out_dir = ROOT / "public" / "style-samples" / "minors"
    out_dir.mkdir(parents=True, exist_ok=True)
    ref = ensure_king_ref()

    def one(item):
        app_id, subject = item
        out = out_dir / f"{app_id}.webp"
        if out.exists():
            return f"skip {app_id}"
        prompt = ANCHOR + KING_MODE.format(subject=subject) + TAIL
        try:
            edits_gen(ref, prompt, out, k)
            return f"ok {app_id}"
        except Exception as e:  # noqa: BLE001
            return f"ERROR {app_id}: {e}"

    import concurrent.futures as cf
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        for line in pool.map(one, MINOR_SUBJECTS.items()):
            print(line, flush=True)

# ---------------- 生图（edits 参考图模式） ----------------

def key():
    if k := __import__("os").environ.get("BYTECAT_KEY"):
        return k
    return re.search(r"api-key:\s*(\S+)", SECRETS.read_text(encoding="utf-8")).group(1)


def fit_crop(im, w, h):
    """按目标比例居中裁切再缩放（图源 2:3 竖版 -> 裁宽保高，勿裁高产生黑边）。"""
    src_ratio = im.width / im.height
    dst_ratio = w / h
    if src_ratio > dst_ratio:  # 图源更宽：裁宽
        tw = int(im.height * dst_ratio)
        x = (im.width - tw) // 2
        im = im.crop((x, 0, x + tw, im.height))
    else:                      # 图源更高：裁高
        th = int(im.width / dst_ratio)
        y = (im.height - th) // 2
        im = im.crop((0, y, im.width, y + th))
    return im.resize((w, h), Image.LANCZOS)


def edits_gen(ref_png, prompt, out_webp, k):
    proc = subprocess.run(
        ["curl", "-s", "--noproxy", "*", "-m", "300", "-X", "POST", API,
         "-H", f"Authorization: Bearer {k}",
         "-F", "model=gpt-image-2", "-F", f"image=@{ref_png}",
         "-F", "size=1024x1536", "-F", "quality=medium", "-F", f"prompt={prompt}"],
        capture_output=True, text=True, timeout=320)
    d = json.loads(proc.stdout)
    item = d["data"][0] if d.get("data") else None
    raw = None
    if item and item.get("b64_json"):
        raw = base64.b64decode(item["b64_json"])
    elif item and item.get("url"):
        # 2026-08-22 起代理有时改回托管 URL：下载图片（先直连再走系统代理）
        for extra in (["--noproxy", "*"], []):
            dl = subprocess.run(["curl", "-s", "-m", "120", *extra, item["url"]],
                                capture_output=True, timeout=130)
            if dl.stdout[:4] in (b"\x89PNG", b"RIFF") or dl.stdout[:2] == b"\xff\xd8":
                raw = dl.stdout
                break
    if not raw:
        raise RuntimeError(f"生图失败: {str(d)[:200]}")
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    im = fit_crop(im, CARD_W, CARD_H)
    im.save(out_webp, "WEBP", quality=85)


def sim(f1, f2):
    a = Image.open(f1).convert("L").resize((16, 32))
    b = Image.open(f2).convert("L").resize((16, 32))
    pa, pb = list(a.getdata()), list(b.getdata())
    n = len(pa)
    ma, mb = sum(pa) / n, sum(pb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(pa, pb))
    va = sum((x - ma) ** 2 for x in pa)
    vb = sum((y - mb) ** 2 for y in pb)
    return cov / math.sqrt(va * vb) if va and vb else 0


def ensure_ref(n):
    ref = ROOT / f"ref_mural_{n:02d}.png"
    if not ref.exists():
        Image.open(ORIG / ORIG_FILES[n]).save(ref, "PNG")
    return ref


def gen_major(app_id, game_no, mode, subject, k):
    out = DECK / f"{app_id}.webp"
    if out.exists():
        return f"skip {app_id}"
    ref = ensure_ref(game_no)
    orig = ORIG / ORIG_FILES[game_no]
    prompt = ANCHOR + MODE[mode].format(subject=subject) + TAIL
    for attempt in (1, 2):
        edits_gen(ref, prompt, out, k)
        s = sim(out, orig)
        if abs(s) <= SIM_OK:
            return f"ok {app_id} sim={s:+.3f}"
        if attempt == 1:
            out.unlink()  # 越界：删除重生成一次
    s = sim(out, orig)
    if abs(s) <= 0.35:
        return f"KEEP(marginal) {app_id} sim={s:+.3f}"
    out.unlink()  # 真越界：直接删除，不许进 manifest（版权护栏，勿改回保留）
    return f"FAIL {app_id} sim={s:+.3f}（已删除）"


def gen_back(k):
    out = DECK / "back.webp"
    if out.exists():
        return "skip back"
    ref = ensure_ref(22)  # 世界原画：最具「装置感」
    edits_gen(ref, ANCHOR + BACK_SUBJECT + " " + TAIL, out, k)
    return "ok back"


def ensure_king_ref():
    """皇帝大牌转 PNG 作四王统一画风锚点（不给模型看各王原画，构图由文字驱动）。"""
    ref = ROOT / "ref_mural_king.png"
    if not ref.exists():
        Image.open(DECK / f"major-{KING_ANCHOR_NO:02d}.webp").convert("RGB").save(ref, "PNG")
    return ref


def gen_kings(k):
    """PL 四王样张：输出 public/style-samples/kings/（本地目录，不入库）。
    先给用户目验，确认后再复制进 DECK 正式替换小牌模版。
    锚点=皇帝大牌（画风），构图=文字题材；护栏仍对比各王 PL 原画。"""
    out_dir = ROOT / "public" / "style-samples" / "kings"
    out_dir.mkdir(parents=True, exist_ok=True)
    ref = ensure_king_ref()
    for app_id, (game_no, subject) in KING_SUBJECTS.items():
        out = out_dir / f"{app_id}.webp"
        if out.exists():
            print(f"skip {app_id}", flush=True)
            continue
        orig = ORIG / ORIG_FILES[game_no]
        prompt = ANCHOR + KING_MODE.format(subject=subject) + TAIL
        try:
            for attempt in (1, 2):
                edits_gen(ref, prompt, out, k)
                s = sim(out, orig)
                if abs(s) <= SIM_OK:
                    print(f"ok {app_id} sim={s:+.3f}", flush=True)
                    break
                if attempt == 1:
                    out.unlink()  # 越界：删除重生成一次
            else:
                s = sim(out, orig)
                if abs(s) <= 0.35:
                    print(f"KEEP(marginal) {app_id} sim={s:+.3f}", flush=True)
                else:
                    out.unlink()  # 真越界：删除不许入库（与大牌同口径）
                    print(f"FAIL {app_id} sim={s:+.3f}（已删除）", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"ERROR {app_id}: {e}", flush=True)


# ---------------- 小牌：PIL 扁平壁画 ----------------

SUIT_COLOR = {  # (描边暗色, 芯色) 模版印双层
    "wands": ((120, 24, 16), (200, 60, 34)),      # 血红橙
    "cups": ((96, 18, 40), (188, 52, 92)),        # 深品红
    "swords": ((44, 30, 70), (150, 120, 200)),    # 暗紫
    "pentacles": ((96, 70, 12), (222, 178, 60)),  # 暗金
}
COURT_CN = {11: "侍从", 12: "骑士", 13: "王后", 14: "国王"}

def draw_wands(d, box, col):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2; w = max(5, (x1 - x0) * 0.16)
    d.line([(cx, y0 + w), (cx, y1 - w)], fill=col, width=int(w))
    d.ellipse([cx - w * 1.4, y0 - w * 0.4, cx + w * 1.4, y0 + w * 2.4], fill=col)
    d.ellipse([cx - w * 0.8, y1 - w * 1.6, cx + w * 0.8, y1], fill=col)

def draw_cups(d, box, col):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2; w = max(4, (x1 - x0) * 0.11)
    d.arc([x0, y0, x1, y0 + (y1 - y0) * 0.75], 180, 360, fill=col, width=int(w))
    d.line([(cx, y0 + (y1 - y0) * 0.75), (cx, y1 - w * 2)], fill=col, width=int(w))
    d.line([(cx - w * 3, y1), (cx + w * 3, y1)], fill=col, width=int(w))
    d.line([(x0 - w, y0), (x1 + w, y0)], fill=col, width=int(w))

def draw_swords(d, box, col):
    (x0, y0), (x1, y1) = box
    cx = (x0 + x1) / 2; w = max(4, (x1 - x0) * 0.15)
    d.polygon([(cx, y0), (cx + w, y0 + (y1 - y0) * 0.3), (cx + w, y1 - w * 4), (cx, y1),
               (cx - w, y1 - w * 4), (cx - w, y0 + (y1 - y0) * 0.3)], fill=col)
    gy = y1 - w * 4
    d.line([(cx - w * 3, gy), (cx + w * 3, gy)], fill=col, width=int(w))
    d.ellipse([cx - w, gy + w, cx + w, gy + w * 3], fill=col)

def draw_pentacles(d, box, col):
    import math as _m
    (x0, y0), (x1, y1) = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = min(x1 - x0, y1 - y0) / 2; w = max(4, r * 0.15)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=int(w))
    pts = [(cx + r * 0.78 * _m.cos(a), cy + r * 0.78 * _m.sin(a))
           for a in [i * 4 * _m.pi / 5 - _m.pi / 2 for i in range(5)]]
    d.line(pts + [pts[0]], fill=col, width=int(w))

GLYPHS = {"wands": draw_wands, "cups": draw_cups, "swords": draw_swords, "pentacles": draw_pentacles}

PIP_LAYOUTS = {
    2: [(.5, .16), (.5, .84)], 3: [(.5, .1), (.28, .68), (.72, .68)],
    4: [(.28, .2), (.72, .2), (.28, .7), (.72, .7)],
    5: [(.26, .18), (.74, .18), (.5, .42), (.26, .72), (.74, .72)],
    6: [(.26, .14), (.74, .14), (.26, .46), (.74, .46), (.26, .78), (.74, .78)],
    7: [(.26, .1), (.5, .22), (.74, .1), (.2, .52), (.44, .64), (.68, .52), (.56, .84)],
    8: [(.26, .1), (.74, .1), (.26, .37), (.74, .37), (.26, .64), (.74, .64), (.26, .9), (.74, .9)],
    9: [(.26, .1), (.5, .1), (.74, .1), (.26, .45), (.5, .45), (.74, .45), (.26, .8), (.5, .8), (.74, .8)],
    10: [(.26, .08), (.5, .08), (.74, .08), (.26, .4), (.5, .4), (.74, .4), (.5, .55), (.26, .82), (.5, .82), (.74, .82)],
}

def minor_card(suit, num):
    edge, core = SUIT_COLOR[suit]
    im = Image.new("RGB", (CARD_W, CARD_H))
    d = ImageDraw.Draw(im)
    for y in range(CARD_H):  # 近黑底带暗红晕
        t = y / CARD_H
        d.line([(0, y), (CARD_W, y)], fill=(14 + int(10 * (1 - t)), 6, 8))
    # 血红细框 + 角标
    d.rounded_rectangle([14, 14, CARD_W - 14, CARD_H - 14], radius=18, outline=(96, 16, 16), width=2)
    for cx, cy in [(14, 14), (CARD_W - 14, 14), (14, CARD_H - 14), (CARD_W - 14, CARD_H - 14)]:
        d.line([(cx - 10, cy), (cx + 10, cy)], fill=(96, 16, 16), width=2)
        d.line([(cx, cy - 10), (cx, cy + 10)], fill=(96, 16, 16), width=2)

    def stencil(draw_fn, box):
        (x0, y0), (x1, y1) = box
        draw_fn(d, box, edge)    # 模版印：先暗描边层
        inset = 4
        draw_fn(d, ((x0 + inset, y0 + inset), (x1 - inset, y1 - inset)), core)  # 后亮芯层

    if num == 1:
        cx, cy = CARD_W / 2, CARD_H / 2
        for a in range(0, 360, 30):
            import math as _m
            d.line([(cx + 95 * _m.cos(_m.radians(a)), cy + 95 * _m.sin(_m.radians(a))),
                    (cx + 135 * _m.cos(_m.radians(a)), cy + 135 * _m.sin(_m.radians(a)))],
                   fill=edge, width=2)
        stencil(GLYPHS[suit], ((cx - 62, cy - 62), (cx + 62, cy + 62)))
    elif num <= 10:
        s = 52 if num <= 4 else (46 if num <= 6 else 40)
        for rx, ry in PIP_LAYOUTS[num]:
            cx = 70 + rx * (CARD_W - 140)
            cy = 130 + ry * (CARD_H - 240)
            stencil(GLYPHS[suit], ((cx - s / 2, cy - s), (cx + s / 2, cy + s)))
    else:
        font = None
        for cand in (r"C:\Windows\Fonts\msyhbd.ttc",
                     "/System/Library/Fonts/PingFang.ttc",
                     "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
                     "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"):
            try:
                font = ImageFont.truetype(cand, 44)
                break
            except OSError:
                continue
        if font is None:
            raise SystemExit("找不到中文字体（msyhbd/PingFang/Noto CJK/WQY），宫廷牌无法生成")
        txt = COURT_CN[num]
        bb = d.textbbox((0, 0), txt, font=font)
        d.text(((CARD_W - bb[2] + bb[0]) / 2, 66), txt, font=font, fill=edge)
        d.text(((CARD_W - bb[2] + bb[0]) / 2 + 2, 68), txt, font=font, fill=core)
        cx, cy = CARD_W / 2, CARD_H * 0.58
        stencil(GLYPHS[suit], ((cx - 80, cy - 90), (cx + 80, cy + 90)))
        d.line([(cx - 60, cy + 130), (cx + 60, cy + 130)], fill=edge, width=2)
    return im

# ---------------- 注册 ----------------

def content_v(files):
    """按文件内容算 12 位版本号：卡面重绘后 v 变化 -> 前端 URL ?v= 变化 -> SW CacheFirst 缓存失效。"""
    h = hashlib.md5()
    for f in sorted(files):
        h.update(Path(f).read_bytes())
    return h.hexdigest()[:12]


def stamp_version(manifest):
    """manifest 写入/刷新 v（牌面缓存破解）；重绘后重跑 --register 即可让用户拉到新图。"""
    files = [DECK / f for f in manifest.get("cards", {}).values()]
    if manifest.get("back"):
        files.append(DECK / manifest["back"])
    manifest["v"] = content_v(files)
    manifest_path = DECK / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def register():
    manifest_path = DECK / "manifest.json"
    if manifest_path.exists():
        # 注册幂等：已有定稿 manifest（手改过 author 等）只校验不覆写，
        # 防止重跑 --register 把定稿内容回退到模板（2026-08-24 审查修复）
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        missing = [f for f in existing.get("cards", {}).values() if not (DECK / f).exists()]
        if missing:
            raise SystemExit(f"manifest 引用了不存在的文件：{missing[:3]}")
        stamp_version(existing)
        print(f"manifest 已存在（{existing.get('name')}，{len(existing.get('cards', {}))} 张），跳过覆写（已刷新版本号 v={existing.get('v')}）")
        return

    cards = {}
    for i in range(22):
        cards[f"major-{i:02d}"] = f"major-{i:02d}.webp"
    for suit in ("wands", "cups", "swords", "pentacles"):
        for n in range(1, 15):
            cards[f"{suit}-{n:02d}"] = f"{suit}-{n:02d}.webp"
    expected = set(cards.values()) | {"back.webp"}
    present = {f.name for f in DECK.glob("*.webp")}
    if present != expected:
        raise SystemExit(f"卡面不齐（缺 {sorted(expected - present)[:3]}，多 {sorted(present - expected)[:3]}），拒绝注册")
    manifest = {
        "id": "night-mural", "name": "致敬夜之城",
        "author": "AI 二创（gpt-image-2，CP2077 塔罗壁画画风致敬）",
        "back": "back.webp", "cards": cards,
    }
    stamp_version(manifest)
    DECK.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    idx_path = ROOT / "public" / "decks" / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    if "night-mural" not in idx:
        idx.append("night-mural")
        idx_path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
    print("registered:", idx)

    # 牌背同步注册进独立牌背注册表：牌背选择/牌背墙只读 backs/index.json，
    # 皮肤自带 back.webp 不注册就是死资产
    backs_path = ROOT / "public" / "backs" / "index.json"
    backs = json.loads(backs_path.read_text(encoding="utf-8"))
    entry = next((b for b in backs if b["id"] == "night-mural"), None)
    if not entry:
        (ROOT / "public" / "backs" / "night-mural.webp").write_bytes((DECK / "back.webp").read_bytes())
        entry = {"id": "night-mural", "name": "致敬夜之城", "file": "night-mural.webp"}
        backs.append(entry)
    else:  # 已注册：同步卡背文件（可能重绘过），并刷新 v 破缓存
        (ROOT / "public" / "backs" / "night-mural.webp").write_bytes((DECK / "back.webp").read_bytes())
    entry["v"] = content_v([ROOT / "public" / "backs" / "night-mural.webp"])
    backs_path.write_text(json.dumps(backs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("backs registered:", [b["id"] for b in backs])

def main():
    DECK.mkdir(parents=True, exist_ok=True)
    if "--minors" in sys.argv:
        n = 0
        for suit in SUIT_COLOR:
            for num in range(1, 15):
                out = DECK / f"{suit}-{num:02d}.webp"
                if out.exists():
                    continue
                minor_card(suit, num).save(out, "WEBP", quality=85)
                n += 1
        print(f"[minors] 新生成 {n} 张")
        return
    if "--register" in sys.argv:
        register()
        return
    if "--kings" in sys.argv:
        gen_kings(key())
        return
    if "--minor-samples" in sys.argv:
        gen_minor_samples(key())
        return

    k = key()
    # 愚者：复用已确认的 D1 样稿
    fool = DECK / "major-00.webp"
    if not fool.exists():
        fit_crop(Image.open(ROOT / "public/style-samples/draft-rework1.webp").convert("RGB"),
                 CARD_W, CARD_H).save(fool, "WEBP", quality=85)
        print("[major-00] 复用 C1 样稿并规整为 500x839")
    order = sorted(SUBJECTS.items())
    for app_id, (mode, subject) in order:
        game_no = int(app_id.split("-")[1]) + 1
        try:
            print(gen_major(app_id, game_no, mode, subject, k), flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"ERROR {app_id}: {e}", flush=True)
    try:
        print(gen_back(k), flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR back: {e}", flush=True)

if __name__ == "__main__":
    main()
