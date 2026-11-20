import { Assets } from "./assets";
import { BonusType } from "./types/screen-objects/IBonus";
import { IDifficultySettings } from "./types/session";
import { Point2D } from "./utils/geometry/Point2D";

// "desktop" builds are served by the game server itself (the desktop app or a
// LAN host), so the API lives on the page's own origin. "web" builds talk to
// the hosted server. Set at build time by webpack (DUNGERRA_TARGET).
export const IS_DESKTOP_BUILD = process.env.DUNGERRA_TARGET === "desktop";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const API_DOMAIN = IS_DESKTOP_BUILD
  ? window.location.origin
  : IS_PRODUCTION
    ? "https://dungerra.onrender.com"
    : "http://localhost:8080";
export const API_BASE_URL = `${API_DOMAIN}/api/v1`;

// GitHub Pages serves the web build under /dungerra/; a game server serves
// the desktop build at its root. Must match publicPath in webpack.config.js.
export const ROUTER_BASENAME =
  IS_PRODUCTION && !IS_DESKTOP_BUILD ? "/dungerra" : "/";

// Display (the view size is dynamic, see utils/Viewport.ts)
export const FONT_NAME = "Texturina";
export const HEADER_FONT_NAME = "Rubik Distressed";

// Mouse aim
export const AIM_SEND_INTERVAL_MS = 33; // Min time between aim-only input messages (~30/s)
export const AIM_SEND_MIN_DELTA_DEG = 1; // Aim changes smaller than this are not sent
export const AIM_DEAD_ZONE_PX = 8; // Cursor this close to the player gives no stable angle; keep previous aim
export const MOUSE_SHOOT_KEY = "MouseLeft"; // Pseudo key code in the active-keys set while the left button is held

// Network smoothing
export const SERVER_TICK_MS = 1000 / 30; // Server game loop interval
export const INTERPOLATION_DELAY_MS = 60; // Entities are drawn this far in the past, so there is usually a newer server update to blend toward
export const TELEPORT_DISTANCE = 150; // A jump larger than this between two updates (e.g. respawn) is shown at once, not blended
export const DRAW_CULL_MARGIN = 128; // Objects this far outside the view are still drawn (textures, labels and bars overhang the collision box)

// World settings
export const TORCH_RADIUS = 200;
export const NIGHT_VISION_DETECTION_RADIUS = 100;
export const SIGHT_RADIUS = 1500;
export const COLOR_LIGHT = "#ffffffff";
export const COLOR_TRANSPARENT = "#ffffff00";
export const COLOR_DARK = "#000000E6";
export const COLOR_NIGHT_VISION = "#009600a0";
export const COLOR_NIGHT_VISION_FADING = "#006000a0";

// Bullet settings
export const BULLET_DAMAGE = 1;
export const BULLET_SIZE = 8;

// Blood settings
export const BLOOD_TEXTURE_SIZE = 32;

// Player settings
export const PLAYER_SPEED = 300; // Units per second
export const PLAYER_SIZE = 24;
export const PLAYER_TEXTURE_SIZE = 64;
export const PLAYER_TEXTURE_CENTER = new Point2D(
  PLAYER_TEXTURE_SIZE / 2 - 1,
  26,
);
export const PLAYER_GUN_END = new Point2D(-10, 20);
export const PLAYER_TORCH_POINT = new Point2D(10, 18);
export const PLAYER_LIVES = 5;
export const PLAYER_INVULNERABILITY_TIME = 1; // Seconds of invulnerability after getting hit
export const PLAYER_ROTATION_SPEED = 180; // Degrees per second
export const PLAYER_SHOOT_DELAY = 0.2; // Seconds between shots
export const PLAYER_BULLET_COLOR = "#00FFFF"; // Cyan bullets for player
export const PLAYER_MAX_BULLETS = 6; // Maximum number of bullets
export const PLAYER_BULLET_RECHARGE_TIME = 1; // Seconds to recharge one bullet
export const PLAYER_BULLET_SPEED = 420; // Units per second
export const PLAYER_REWARD = 100; // Reward for killing an enemy in $

// Enemy settings
export const ENEMY_SPEED = 120; // Units per second
export const ENEMY_SOLDIER_SIZE = 24;
export const ENEMY_TOWER_SIZE = 120;
export const ENEMY_LIVES = 1;
export const ENEMY_LIEUTENANT_LIVES = 2;
export const ENEMY_SNIPER_LIVES = 2;
export const ENEMY_TOWER_LIVES = 30;
export const ENEMY_TEXTURE_SIZE = 64;
export const ENEMY_TOWER_TEXTURE_SIZE = 180;
export const ENEMY_SOLDIER_TEXTURE_CENTER = new Point2D(
  PLAYER_TEXTURE_SIZE / 2 - 1,
  26,
);
export const ENEMY_TOWER_TEXTURE_CENTER = new Point2D(
  ENEMY_TOWER_TEXTURE_SIZE / 2,
  ENEMY_TOWER_TEXTURE_SIZE / 2,
);
export const ENEMY_SOLDIER_GUN_END = new Point2D(-1, 28);
export const ENEMY_TOWER_GUN_END = new Point2D(0, 80);
export const ENEMY_SHOOT_DELAY = 1; // Seconds between shots
export const ENEMY_BULLET_SPEED = 240; // Units per second
export const ENEMY_DEATH_TRACE_TIME = 5; // Seconds the blood stain is visible
export const ENEMY_REWARD = 10; // Reward for killing an enemy in $
export const ENEMY_BULLET_COLOR = "#FF0000"; // Red bullets for enemies
export const ENEMY_LIEUTENANT_BULLET_COLOR = "#0004ffff"; // Blue bullets for lieutenant enemies
export const ENEMY_DROP_CHANCE = 0.3; // Chance to drop a bonus when enemy dies
export const ENEMY_DROP_TYPE_CHANCES: Partial<Record<BonusType, number>> = {
  aid_kit: 5,
  goggles: 1,
};

// Bonuses settings
export const BONUS_SPAWN_CHANCE = 0.3; // Chance to spawn bonus when enemy dies

export const AID_KIT_SIZE = 32;
export const AID_KIT_HEAL_AMOUNT = 2;

export const GOGGLES_SIZE = 32;
export const GOGGLES_ACTIVE_TIME = 20; // Seconds of night vision mode

export const CHEST_SIZE = 32;

// UI settings
export const INVENTORY_MARGIN_BOTTOM = 30;
export const MESSAGE_PADDING_BOTTOM = 160;

// Shop settings
export const SHOP_SIZE = 64;
// The shop window and its legend are scaled down as one block to fit the
// space above the inventory panel (or the whole screen when it is hidden)
export const SHOP_MODAL_SCREEN_PADDING = 16; // CSS px kept clear on every side of the block
export const SHOP_MODAL_LEGEND_GAP = 12; // Between the shop window and the legend, unscaled px
export const SHOP_MODAL_LEGEND_WIDTH = 420; // Legend background width, unscaled px
export const SHOP_MODAL_LEGEND_LINE_HEIGHT = 22; // Unscaled px
export const SHOP_MODAL_LEGEND_PADDING = 8; // Around the legend text, unscaled px

// Asset paths
export const TEXTURES = {
  FLOOR: Assets.floorTexture,
  WALL: Assets.wallTexture,
  PLAYER: Assets.playerTexture,
  PLAYER_SHOTGUN: Assets.playerShotgunTexture,
  PLAYER_RAILGUN: Assets.playerRailgunTexture,
  PLAYER_ROCKET_LAUNCHER: Assets.playerRocketLauncherTexture,
  ENEMY: Assets.enemyTexture,
  ENEMY_SNIPER: Assets.enemySniperTexture,
  ENEMY_LIEUTENANT: Assets.enemyLieutenantTexture,
  ENEMY_TOWER: Assets.enemyTowerTurretTexture,
  ENEMY_TOWER_BACK: Assets.enemyTowerTexture,
  ENEMY_TOWER_RUINED: Assets.enemyTowerRuinedTexture,
  BLOOD: Assets.bloodTexture,
  AID_KIT: Assets.aidKitTexture,
  GOGGLES: Assets.gogglesTexture,
  CHEST: Assets.chestTexture,
  HEART: Assets.heartTexture,
  SHOP: Assets.shopTexturne,
  SHOP_LAYOUT: Assets.shopLayoutTexture,

  INVENTORY: Assets.inventoryTexture,
  ITEM_RAILGUN: Assets.itemRailgunTexture,
  ITEM_ROCKET_LAUNCHER: Assets.itemRocketLauncherTexture,
  ITEM_SHOTGUN: Assets.itemShotgunTexture,
  ITEM_BLASTER: Assets.itemBlasterTexture,
  ITEM_AMMO_SHOTGUN: Assets.itemAmmoShotgunTexture,
  ITEM_AMMO_ROCKET_LAUNCHER: Assets.itemAmmoRocketLauncherTexture,
  ITEM_AMMO_RAILGUN: Assets.itemAmmoRailgunTexture,

  BULLET_ROCKET: Assets.bulletRocketTexture,
};

export const ANIMATIONS = {
  EXPLOSION: Assets.explosionAnimation,
  TORCH_FIRE: Assets.torchFireAnimation,
};

export const SOUNDS = {
  BULLET: Assets.bulletSound,
  TORCH: Assets.torchSound,
  GAME_OVER: Assets.gameOverSound,
  PLAYER_HURT: Assets.playerHurtSound,
  PLAYER_DEAD: Assets.playerDeadSound,
  ENEMY_HURT: Assets.enemyHurtSound,
  PLAYER_BULLET_RECHARGE: Assets.playerBulletRechargeSound,
  BONUS_PICKUP: Assets.bonusPickupSound,
  SPAWN: Assets.spawnSound,
  ROCKET_LAUNCHER: Assets.rocketLauncherSound,
  ROCKET_BLAST: Assets.rocketBlastSound,
  RAILGUN: Assets.railgunSound,
  SHOTGUN: Assets.shotgunSound,
  ENTER_SHOP: Assets.enterShopSound,
  MONEY_SPENT: Assets.moneySpentSound,
  MISTAKE: Assets.mistakeSound,
  TOWER_HIT: Assets.towerHitSound,
  TOWER_CRASH: Assets.towerCrashSound,
};

export type WeaponType = "blaster" | "shotgun" | "railgun" | "rocket_launcher";

export const ENEMY_TYPES = {
  SOLDIER: "pr",
  LIEUTENANT: "lt",
  TOWER: "tw",
  SNIPER: "sn",
} as const;

export type EnemyType = (typeof ENEMY_TYPES)[keyof typeof ENEMY_TYPES];

export const ENEMY_LIVES_BY_TYPE: Record<EnemyType, number> = {
  [ENEMY_TYPES.SOLDIER]: ENEMY_LIVES,
  [ENEMY_TYPES.LIEUTENANT]: ENEMY_LIEUTENANT_LIVES,
  [ENEMY_TYPES.TOWER]: ENEMY_TOWER_LIVES,
  [ENEMY_TYPES.SNIPER]: ENEMY_SNIPER_LIVES,
};

export const ENEMY_TEXTURE_BY_TYPE: Record<EnemyType, string> = {
  [ENEMY_TYPES.SOLDIER]: TEXTURES.ENEMY,
  [ENEMY_TYPES.LIEUTENANT]: TEXTURES.ENEMY_LIEUTENANT,
  [ENEMY_TYPES.TOWER]: TEXTURES.ENEMY_TOWER,
  [ENEMY_TYPES.SNIPER]: TEXTURES.ENEMY_SNIPER,
};

export const ENEMY_DEAD_TEXTURE_BY_TYPE: Record<EnemyType, string> = {
  [ENEMY_TYPES.SOLDIER]: TEXTURES.BLOOD,
  [ENEMY_TYPES.LIEUTENANT]: TEXTURES.BLOOD,
  [ENEMY_TYPES.TOWER]: TEXTURES.ENEMY_TOWER_RUINED,
  [ENEMY_TYPES.SNIPER]: TEXTURES.BLOOD,
};

export const WEAPON_TYPES: readonly WeaponType[] = [
  "blaster",
  "shotgun",
  "railgun",
  "rocket_launcher",
] as const;

export const INVENTORY_ITEM_IDS = {
  BLASTER: 1,
  SHOTGUN: 2,
  ROCKET_LAUNCHER: 3,
  RAILGUN: 4,
  AMMO_SHOTGUN: 22,
  AMMO_ROCKET_LAUNCHER: 23,
  AMMO_RAILGUN: 24,
  GOGGLES: 7,
  AID_KIT: 8,
  MONEY: 100,
} as const;

export type InventoryItemID =
  (typeof INVENTORY_ITEM_IDS)[keyof typeof INVENTORY_ITEM_IDS];

export const AMMO_ITEM_IDS: InventoryItemID[] = [
  INVENTORY_ITEM_IDS.AMMO_SHOTGUN,
  INVENTORY_ITEM_IDS.AMMO_ROCKET_LAUNCHER,
  INVENTORY_ITEM_IDS.AMMO_RAILGUN,
];

export const INVENTORY_ITEM_TEXTURES: Partial<Record<InventoryItemID, string>> =
  {
    [INVENTORY_ITEM_IDS.BLASTER]: TEXTURES.ITEM_BLASTER,
    [INVENTORY_ITEM_IDS.SHOTGUN]: TEXTURES.ITEM_SHOTGUN,
    [INVENTORY_ITEM_IDS.ROCKET_LAUNCHER]: TEXTURES.ITEM_ROCKET_LAUNCHER,
    [INVENTORY_ITEM_IDS.RAILGUN]: TEXTURES.ITEM_RAILGUN,

    [INVENTORY_ITEM_IDS.AMMO_SHOTGUN]: TEXTURES.ITEM_AMMO_SHOTGUN,
    [INVENTORY_ITEM_IDS.AMMO_ROCKET_LAUNCHER]:
      TEXTURES.ITEM_AMMO_ROCKET_LAUNCHER,
    [INVENTORY_ITEM_IDS.AMMO_RAILGUN]: TEXTURES.ITEM_AMMO_RAILGUN,

    [INVENTORY_ITEM_IDS.AID_KIT]: TEXTURES.AID_KIT,
    [INVENTORY_ITEM_IDS.GOGGLES]: TEXTURES.GOGGLES,
  };

export const BULLET_SOUND_BY_WEAPON_TYPE: Record<WeaponType, string> = {
  blaster: SOUNDS.BULLET,
  shotgun: SOUNDS.SHOTGUN,
  railgun: SOUNDS.RAILGUN,
  rocket_launcher: SOUNDS.ROCKET_LAUNCHER,
} as const;

export const WEAPON_TYPES_LOADED_DIRECTLY_FROM_INVENTORY: WeaponType[] = [
  "railgun",
  "rocket_launcher",
] as const;

export const AMMO_INVENTORY_ID_BY_WEAPON_TYPE: Partial<
  Record<WeaponType, InventoryItemID>
> = {
  shotgun: 22,
  rocket_launcher: 23,
  railgun: 24,
} as const;

export const WEAPON_INVENTORY_ID_BY_WEAPON_TYPE: Record<
  WeaponType,
  InventoryItemID
> = {
  blaster: 1,
  shotgun: 2,
  rocket_launcher: 3,
  railgun: 4,
};

export const INVENTORY_ITEM_BONUS = [7, 8];

export const BULLET_SYMBOL: Record<WeaponType, string> = {
  blaster: "●",
  shotgun: "⁍",
  railgun: "⚡",
  rocket_launcher: "🚀",
};

export const PLAYER_TEXTURE_BY_WEAPON_TYPE: Record<WeaponType, string> = {
  blaster: TEXTURES.PLAYER,
  shotgun: TEXTURES.PLAYER_SHOTGUN,
  railgun: TEXTURES.PLAYER_RAILGUN,
  rocket_launcher: TEXTURES.PLAYER_ROCKET_LAUNCHER,
};

export const BULLET_AFTERLIFE_MS_BY_WEAPON_TYPE: Record<WeaponType, number> = {
  blaster: 0,
  shotgun: 0,
  railgun: 200,
  rocket_launcher: ANIMATIONS.EXPLOSION.duration,
};

export const BULLET_COLOR_BY_ENEMY_TYPE: Partial<Record<EnemyType, string>> = {
  [ENEMY_TYPES.SOLDIER]: ENEMY_BULLET_COLOR,
  [ENEMY_TYPES.LIEUTENANT]: ENEMY_LIEUTENANT_BULLET_COLOR,
  [ENEMY_TYPES.SNIPER]: PLAYER_BULLET_COLOR,
};

export const ENEMY_SIZE_BY_TYPE: Record<EnemyType, number> = {
  [ENEMY_TYPES.SOLDIER]: ENEMY_SOLDIER_SIZE,
  [ENEMY_TYPES.LIEUTENANT]: ENEMY_SOLDIER_SIZE,
  [ENEMY_TYPES.SNIPER]: ENEMY_SOLDIER_SIZE,
  [ENEMY_TYPES.TOWER]: ENEMY_TOWER_SIZE,
};

export const ENEMY_GUN_END_BY_TYPE: Record<EnemyType, Point2D> = {
  [ENEMY_TYPES.SOLDIER]: ENEMY_SOLDIER_GUN_END,
  [ENEMY_TYPES.LIEUTENANT]: ENEMY_SOLDIER_GUN_END,
  [ENEMY_TYPES.SNIPER]: ENEMY_SOLDIER_GUN_END,
  [ENEMY_TYPES.TOWER]: ENEMY_TOWER_GUN_END,
};

export const RAY_TYPES = {
  LASER: "laser",
  PROJECTOR: "projector",
} as const;

export type RayType = (typeof RAY_TYPES)[keyof typeof RAY_TYPES];

// Difficulty. The server owns these values and stores them per session; the
// client mirrors them (../dungerra-api/internal/config/difficulty.go) only to
// describe presets and preview a custom difficulty's score multiplier.
export const DIFFICULTY_PRESETS = {
  PEACEFUL: "peaceful",
  EASY: "easy",
  HARD: "hard",
  NIGHTMARE: "nightmare",
  CUSTOM: "custom",
} as const;

export type DifficultyPreset =
  (typeof DIFFICULTY_PRESETS)[keyof typeof DIFFICULTY_PRESETS];

export type NamedDifficultyPreset = Exclude<
  DifficultyPreset,
  typeof DIFFICULTY_PRESETS.CUSTOM
>;

export const DIFFICULTY_LABELS: Record<DifficultyPreset, string> = {
  [DIFFICULTY_PRESETS.PEACEFUL]: "Peaceful",
  [DIFFICULTY_PRESETS.EASY]: "Easy",
  [DIFFICULTY_PRESETS.HARD]: "Hard",
  [DIFFICULTY_PRESETS.NIGHTMARE]: "Nightmare",
  [DIFFICULTY_PRESETS.CUSTOM]: "Custom",
};

export const DIFFICULTY_DESCRIPTIONS: Record<DifficultyPreset, string> = {
  [DIFFICULTY_PRESETS.PEACEFUL]:
    "No enemies. Loot chests by a quarter of the walls. Double money.",
  [DIFFICULTY_PRESETS.EASY]:
    "Half the guards, no snipers or towers. Slower fire, 8 lives. Double money and drops.",
  [DIFFICULTY_PRESETS.HARD]: "The full dungeon, as it was meant to be.",
  [DIFFICULTY_PRESETS.NIGHTMARE]:
    "1.5× guards, snipers and towers. 1.5× money.",
  [DIFFICULTY_PRESETS.CUSTOM]: "Tune every setting yourself.",
};

export const DIFFICULTY_PRESET_SETTINGS: Record<
  NamedDifficultyPreset,
  IDifficultySettings
> = {
  [DIFFICULTY_PRESETS.PEACEFUL]: {
    soldiers_pct: 0,
    lieutenants_pct: 0,
    snipers_pct: 0,
    towers_pct: 0,
    money_pct: 200,
    drop_chance_pct: 100,
    wall_chest_pct: 25,
    enemy_fire_rate_pct: 100,
    player_lives: 6,
  },
  [DIFFICULTY_PRESETS.EASY]: {
    soldiers_pct: 50,
    lieutenants_pct: 50,
    snipers_pct: 0,
    towers_pct: 0,
    money_pct: 200,
    drop_chance_pct: 200,
    wall_chest_pct: 0,
    enemy_fire_rate_pct: 75,
    player_lives: 8,
  },
  [DIFFICULTY_PRESETS.HARD]: {
    soldiers_pct: 100,
    lieutenants_pct: 100,
    snipers_pct: 100,
    towers_pct: 100,
    money_pct: 100,
    drop_chance_pct: 100,
    wall_chest_pct: 0,
    enemy_fire_rate_pct: 100,
    player_lives: 6,
  },
  [DIFFICULTY_PRESETS.NIGHTMARE]: {
    soldiers_pct: 150,
    lieutenants_pct: 150,
    snipers_pct: 150,
    towers_pct: 150,
    money_pct: 150,
    drop_chance_pct: 100,
    wall_chest_pct: 0,
    enemy_fire_rate_pct: 100,
    player_lives: 6,
  },
};

export interface IDifficultyField {
  key: keyof IDifficultySettings;
  label: string;
  min: number;
  max: number;
  step: number;
  isPercent: boolean;
  isAdvanced: boolean; // Shown under "Advanced" in the custom section
}

// Ranges match the server's validation, which rejects values outside them.
export const DIFFICULTY_FIELDS: readonly IDifficultyField[] = [
  {
    key: "soldiers_pct",
    label: "Soldiers",
    min: 0,
    max: 200,
    step: 10,
    isPercent: true,
    isAdvanced: false,
  },
  {
    key: "lieutenants_pct",
    label: "Lieutenants",
    min: 0,
    max: 200,
    step: 10,
    isPercent: true,
    isAdvanced: false,
  },
  {
    key: "snipers_pct",
    label: "Snipers",
    min: 0,
    max: 200,
    step: 10,
    isPercent: true,
    isAdvanced: false,
  },
  {
    key: "towers_pct",
    label: "Towers",
    min: 0,
    max: 200,
    step: 10,
    isPercent: true,
    isAdvanced: false,
  },
  {
    key: "money_pct",
    label: "Money per kill",
    min: 0,
    max: 300,
    step: 25,
    isPercent: true,
    isAdvanced: true,
  },
  {
    key: "drop_chance_pct",
    label: "Drop chance",
    min: 0,
    max: 300,
    step: 25,
    isPercent: true,
    isAdvanced: true,
  },
  {
    key: "wall_chest_pct",
    label: "Walls with chests",
    min: 0,
    max: 100,
    step: 5,
    isPercent: true,
    isAdvanced: true,
  },
  {
    key: "enemy_fire_rate_pct",
    label: "Enemy fire rate",
    min: 25,
    max: 200,
    step: 5,
    isPercent: true,
    isAdvanced: true,
  },
  {
    key: "player_lives",
    label: "Lives",
    min: 1,
    max: 12,
    step: 1,
    isPercent: false,
    isAdvanced: true,
  },
];

// Score multiplier formula (mirrors config.ComputeScoreMultiplier on the server)
export const SCORE_WEIGHT_SOLDIERS = 0.4;
export const SCORE_WEIGHT_LIEUTENANTS = 0.25;
export const SCORE_WEIGHT_SNIPERS = 0.15;
export const SCORE_WEIGHT_TOWERS = 0.2;
export const SCORE_MULTIPLIER_MIN = 0.25;
export const SCORE_MULTIPLIER_MAX = 2;
export const SCORE_MULTIPLIER_STEPS = 20; // Rounded to 1/20 = 0.05
export const SCORE_NEUTRAL_PLAYER_LIVES = 6; // Hard's lives, where the lives factor is 1
