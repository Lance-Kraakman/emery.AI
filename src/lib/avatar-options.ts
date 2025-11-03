/**
 * DiceBear Style-Specific Options Configuration
 *
 * Defines available customization options for each avatar style.
 * Each style has different options - this centralizes the configuration.
 */

export interface StyleOption {
  name: string;
  label: string;
  type: 'select' | 'color' | 'probability';
  options?: Array<{ value: string; label: string }>;
  default?: string | number;
  description?: string;
}

export interface StyleConfiguration {
  name: string;
  options: StyleOption[];
}

/**
 * Lorelei Style Options
 * Artistic character illustrations with detailed customization
 */
export const loreleiOptions: StyleConfiguration = {
  name: 'lorelei',
  options: [
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Variant 1' },
        { value: 'variant02', label: 'Variant 2' },
        { value: 'variant03', label: 'Variant 3' },
        { value: 'variant04', label: 'Variant 4' },
        { value: 'variant05', label: 'Variant 5' },
      ],
    },
    {
      name: 'eyebrows',
      label: 'Eyebrows',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Variant 1' },
        { value: 'variant02', label: 'Variant 2' },
        { value: 'variant03', label: 'Variant 3' },
        { value: 'variant04', label: 'Variant 4' },
      ],
    },
    {
      name: 'mouth',
      label: 'Mouth',
      type: 'select',
      options: [
        { value: 'happy01', label: 'Happy 1' },
        { value: 'happy02', label: 'Happy 2' },
        { value: 'sad01', label: 'Sad 1' },
        { value: 'sad02', label: 'Sad 2' },
      ],
    },
    {
      name: 'hair',
      label: 'Hair Style',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
        { value: 'variant04', label: 'Style 4' },
        { value: 'variant05', label: 'Style 5' },
      ],
    },
    {
      name: 'frecklesProbability',
      label: 'Freckles 0-100',
      type: 'probability',
      default: 0,
      description: 'Probability of showing freckles',
    },
    {
      name: 'glassesProbability',
      label: 'Glasses 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing glasses',
    },
    {
      name: 'beardProbability',
      label: 'Beard 0-100',
      type: 'probability',
      default: 5,
      description: 'Probability of showing beard',
    },
    {
      name: 'earringsProbability',
      label: 'Earrings 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing earrings',
    },
    {
      name: 'hairAccessoriesProbability',
      label: 'Hair Accessories 0-100',
      type: 'probability',
      default: 5,
      description: 'Probability of wearing hair accessories',
    },
  ],
};

/**
 * Avataaars Style Options
 * Popular cartoon-style avatars with extensive customization
 */
export const avataaarsOptions: StyleConfiguration = {
  name: 'avataaars',
  options: [
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'happy', label: 'Happy' },
        { value: 'cry', label: 'Crying' },
        { value: 'hearts', label: 'Hearts' },
        { value: 'squint', label: 'Squint' },
        { value: 'surprised', label: 'Surprised' },
        { value: 'wink', label: 'Wink' },
      ],
    },
    {
      name: 'eyebrows',
      label: 'Eyebrows',
      type: 'select',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'defaultNatural', label: 'Natural' },
        { value: 'angry', label: 'Angry' },
        { value: 'raisedExcited', label: 'Raised' },
        { value: 'sadConcerned', label: 'Sad' },
        { value: 'unibrowNatural', label: 'Unibrow' },
      ],
    },
    {
      name: 'mouth',
      label: 'Mouth',
      type: 'select',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'smile', label: 'Smile' },
        { value: 'serious', label: 'Serious' },
        { value: 'sad', label: 'Sad' },
        { value: 'eating', label: 'Eating' },
        { value: 'tongue', label: 'Tongue' },
        { value: 'twinkle', label: 'Twinkle' },
      ],
    },
    {
      name: 'top',
      label: 'Hair/Hat',
      type: 'select',
      options: [
        { value: 'shortHair', label: 'Short Hair' },
        { value: 'longHair', label: 'Long Hair' },
        { value: 'bob', label: 'Bob' },
        { value: 'bun', label: 'Bun' },
        { value: 'curly', label: 'Curly' },
        { value: 'dreads', label: 'Dreads' },
        { value: 'frida', label: 'Frida' },
        { value: 'fro', label: 'Fro' },
        { value: 'hat', label: 'Hat' },
        { value: 'hijab', label: 'Hijab' },
        { value: 'turban', label: 'Turban' },
      ],
    },
    {
      name: 'facialHair',
      label: 'Facial Hair',
      type: 'select',
      options: [
        { value: 'beardLight', label: 'Light Beard' },
        { value: 'beardMedium', label: 'Medium Beard' },
        { value: 'beardMajestic', label: 'Majestic Beard' },
        { value: 'moustacheFancy', label: 'Fancy Moustache' },
        { value: 'moustacheMagnum', label: 'Magnum Moustache' },
      ],
    },
    {
      name: 'clothing',
      label: 'Clothing',
      type: 'select',
      options: [
        { value: 'hoodie', label: 'Hoodie' },
        { value: 'blazerAndShirt', label: 'Blazer & Shirt' },
        { value: 'shirtCrewNeck', label: 'Crew Neck' },
        { value: 'shirtVNeck', label: 'V-Neck' },
        { value: 'overall', label: 'Overall' },
      ],
    },
    {
      name: 'accessoriesProbability',
      label: 'Accessories 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing accessories like glasses',
    },
    {
      name: 'facialHairProbability',
      label: 'Facial Hair 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of showing facial hair',
    },
    {
      name: 'topProbability',
      label: 'Hair/Hat 0-100',
      type: 'probability',
      default: 100,
      description: 'Probability of showing hair or hat',
    },
  ],
};

/**
 * Big Smile Style Options
 * Cheerful cartoon characters with expressive features
 */
export const bigSmileOptions: StyleConfiguration = {
  name: 'bigSmile',
  options: [
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'cheery', label: 'Cheery' },
        { value: 'confused', label: 'Confused' },
        { value: 'starstruck', label: 'Starstruck' },
        { value: 'winking', label: 'Winking' },
        { value: 'sleepy', label: 'Sleepy' },
        { value: 'sad', label: 'Sad' },
        { value: 'angry', label: 'Angry' },
      ],
    },
    {
      name: 'hair',
      label: 'Hair Style',
      type: 'select',
      options: [
        { value: 'shortHair', label: 'Short Hair' },
        { value: 'mohawk', label: 'Mohawk' },
        { value: 'wavyBob', label: 'Wavy Bob' },
        { value: 'bowlCut', label: 'Bowl Cut' },
        { value: 'curlyBob', label: 'Curly Bob' },
        { value: 'straight', label: 'Straight' },
        { value: 'braids', label: 'Braids' },
        { value: 'bun', label: 'Bun' },
        { value: 'bangs', label: 'Bangs' },
      ],
    },
    {
      name: 'mouth',
      label: 'Mouth',
      type: 'select',
      options: [
        { value: 'openedSmile', label: 'Opened Smile' },
        { value: 'teethSmile', label: 'Teeth Smile' },
        { value: 'kawaii', label: 'Kawaii' },
        { value: 'awkwardSmile', label: 'Awkward Smile' },
        { value: 'unimpressed', label: 'Unimpressed' },
        { value: 'openSad', label: 'Open Sad' },
        { value: 'braces', label: 'Braces' },
        { value: 'gapSmile', label: 'Gap Smile' },
      ],
    },
    {
      name: 'accessoriesProbability',
      label: 'Accessories 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing accessories',
    },
    {
      name: 'facialHairProbability',
      label: 'Facial Hair 0-100',
      type: 'probability',
      default: 5,
      description: 'Probability of showing facial hair',
    },
  ],
};

/**
 * Simplified options for remaining styles
 * These can be expanded with more specific options later
 */
export const openPeepsOptions: StyleConfiguration = {
  name: 'openPeeps',
  options: [
    {
      name: 'head',
      label: 'Head Shape',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'face',
      label: 'Face',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
  ],
};

export const personasOptions: StyleConfiguration = {
  name: 'personas',
  options: [
    {
      name: 'hair',
      label: 'Hair',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
  ],
};

export const botttsOptions: StyleConfiguration = {
  name: 'bottts',
  options: [
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
  ],
};

export const adventurerOptions: StyleConfiguration = {
  name: 'adventurer',
  options: [
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
  ],
};

export const notionistsOptions: StyleConfiguration = {
  name: 'notionists',
  options: [
    {
      name: 'head',
      label: 'Head',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
  ],
};

/**
 * Map of all style configurations
 */
export const STYLE_OPTIONS: Record<string, StyleConfiguration> = {
  lorelei: loreleiOptions,
  avataaars: avataaarsOptions,
  openPeeps: openPeepsOptions,
  personas: personasOptions,
  bigSmile: bigSmileOptions,
  bottts: botttsOptions,
  adventurer: adventurerOptions,
  notionists: notionistsOptions,
};

/**
 * Get options for a specific style
 */
export function getStyleOptions(styleName: string): StyleConfiguration | null {
  return STYLE_OPTIONS[styleName] || null;
}
