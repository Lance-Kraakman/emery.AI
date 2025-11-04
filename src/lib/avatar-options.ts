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
      name: 'head',
      label: 'Head Shape',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Variant 1' },
        { value: 'variant02', label: 'Variant 2' },
        { value: 'variant03', label: 'Variant 3' },
        { value: 'variant04', label: 'Variant 4' },
      ],
    },
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
      name: 'nose',
      label: 'Nose',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Variant 1' },
        { value: 'variant02', label: 'Variant 2' },
        { value: 'variant03', label: 'Variant 3' },
        { value: 'variant04', label: 'Variant 4' },
        { value: 'variant05', label: 'Variant 5' },
        { value: 'variant06', label: 'Variant 6' },
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
      name: 'accessories',
      label: 'Accessories Type',
      type: 'select',
      options: [
        { value: 'kurt', label: 'Kurt' },
        { value: 'prescription01', label: 'Prescription 1' },
        { value: 'prescription02', label: 'Prescription 2' },
        { value: 'round', label: 'Round' },
        { value: 'sunglasses', label: 'Sunglasses' },
        { value: 'wayfarers', label: 'Wayfarers' },
        { value: 'eyepatch', label: 'Eyepatch' },
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
      name: 'face',
      label: 'Face',
      type: 'select',
      options: [
        { value: 'base', label: 'Base' },
      ],
    },
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
      name: 'accessories',
      label: 'Accessories Type',
      type: 'select',
      options: [
        { value: 'catEars', label: 'Cat Ears' },
        { value: 'glasses', label: 'Glasses' },
        { value: 'sailormoonCrown', label: 'Sailor Moon Crown' },
        { value: 'clownNose', label: 'Clown Nose' },
        { value: 'sleepMask', label: 'Sleep Mask' },
        { value: 'sunglasses', label: 'Sunglasses' },
        { value: 'faceMask', label: 'Face Mask' },
        { value: 'mustache', label: 'Mustache' },
      ],
    },
    {
      name: 'accessoriesProbability',
      label: 'Accessories 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing accessories',
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
      label: 'Hairstyle',
      type: 'select',
      options: [
        { value: 'afro', label: 'Afro' },
        { value: 'bangs', label: 'Bangs' },
        { value: 'bantuKnots', label: 'Bantu Knots' },
        { value: 'bear', label: 'Bear' },
        { value: 'bun', label: 'Bun' },
        { value: 'bun2', label: 'Bun 2' },
        { value: 'buns', label: 'Buns' },
        { value: 'cornrows', label: 'Cornrows' },
        { value: 'cornrows2', label: 'Cornrows 2' },
        { value: 'dreads1', label: 'Dreads 1' },
        { value: 'dreads2', label: 'Dreads 2' },
        { value: 'flatTop', label: 'Flat Top' },
        { value: 'flatTopLong', label: 'Flat Top Long' },
        { value: 'grayBun', label: 'Gray Bun' },
        { value: 'grayMedium', label: 'Gray Medium' },
        { value: 'grayShort', label: 'Gray Short' },
        { value: 'hatBeanie', label: 'Hat Beanie' },
        { value: 'hatHip', label: 'Hat Hip' },
        { value: 'longCurly', label: 'Long Curly' },
        { value: 'mohawk', label: 'Mohawk' },
        { value: 'noHair', label: 'No Hair' },
        { value: 'pomp', label: 'Pomp' },
        { value: 'poop', label: 'Poop' },
        { value: 'short', label: 'Short' },
        { value: 'turban', label: 'Turban' },
        { value: 'twists', label: 'Twists' },
        { value: 'twists2', label: 'Twists 2' },
      ],
    },
    {
      name: 'face',
      label: 'Face Expression',
      type: 'select',
      options: [
        { value: 'awe', label: 'Awe' },
        { value: 'blank', label: 'Blank' },
        { value: 'calm', label: 'Calm' },
        { value: 'concerned', label: 'Concerned' },
        { value: 'confused', label: 'Confused' },
        { value: 'cry', label: 'Cry' },
        { value: 'default', label: 'Default' },
        { value: 'explaining', label: 'Explaining' },
        { value: 'eyesClosed', label: 'Eyes Closed' },
        { value: 'grimace', label: 'Grimace' },
        { value: 'hectic', label: 'Hectic' },
        { value: 'lovingGrin', label: 'Loving Grin' },
        { value: 'mad', label: 'Mad' },
        { value: 'monster', label: 'Monster' },
        { value: 'nose', label: 'Nose' },
        { value: 'smile', label: 'Smile' },
        { value: 'smileBig', label: 'Smile Big' },
        { value: 'smileLOL', label: 'Smile LOL' },
        { value: 'smileTeethGap', label: 'Smile Teeth Gap' },
        { value: 'solemn', label: 'Solemn' },
        { value: 'suspicious', label: 'Suspicious' },
        { value: 'tongueOut', label: 'Tongue Out' },
      ],
    },
    {
      name: 'facialHair',
      label: 'Facial Hair',
      type: 'select',
      options: [
        { value: 'chin', label: 'Chin' },
        { value: 'full', label: 'Full' },
        { value: 'full2', label: 'Full 2' },
        { value: 'full3', label: 'Full 3' },
        { value: 'full4', label: 'Full 4' },
        { value: 'goatee1', label: 'Goatee 1' },
        { value: 'goatee2', label: 'Goatee 2' },
        { value: 'moustache1', label: 'Moustache 1' },
        { value: 'moustache2', label: 'Moustache 2' },
        { value: 'moustache3', label: 'Moustache 3' },
        { value: 'moustache4', label: 'Moustache 4' },
        { value: 'moustache5', label: 'Moustache 5' },
        { value: 'moustache6', label: 'Moustache 6' },
        { value: 'moustache7', label: 'Moustache 7' },
        { value: 'moustache8', label: 'Moustache 8' },
        { value: 'moustache9', label: 'Moustache 9' },
      ],
    },
    {
      name: 'accessories',
      label: 'Accessories Type',
      type: 'select',
      options: [
        { value: 'eyepatch', label: 'Eyepatch' },
        { value: 'glasses', label: 'Glasses' },
        { value: 'glasses2', label: 'Glasses 2' },
        { value: 'glasses3', label: 'Glasses 3' },
        { value: 'glasses4', label: 'Glasses 4' },
        { value: 'glasses5', label: 'Glasses 5' },
        { value: 'sunglasses', label: 'Sunglasses' },
        { value: 'sunglasses2', label: 'Sunglasses 2' },
      ],
    },
    {
      name: 'mask',
      label: 'Mask Type',
      type: 'select',
      options: [
        { value: 'medicalMask', label: 'Medical Mask' },
        { value: 'respirator', label: 'Respirator' },
      ],
    },
    {
      name: 'facialHairProbability',
      label: 'Facial Hair 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of showing facial hair',
    },
    {
      name: 'accessoriesProbability',
      label: 'Accessories 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing accessories',
    },
    {
      name: 'maskProbability',
      label: 'Mask 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing a mask',
    },
  ],
};

export const personasOptions: StyleConfiguration = {
  name: 'personas',
  options: [
    {
      name: 'body',
      label: 'Body Type',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'facialHair',
      label: 'Facial Hair',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'hair',
      label: 'Hair',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'mouth',
      label: 'Mouth',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'nose',
      label: 'Nose',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'facialHairProbability',
      label: 'Facial Hair 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of showing facial hair',
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
        { value: 'variant03', label: 'Style 3' },
        { value: 'variant04', label: 'Style 4' },
      ],
    },
    {
      name: 'face',
      label: 'Face',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'mouth',
      label: 'Mouth',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'sides',
      label: 'Sides/Ears',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'texture',
      label: 'Texture',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'top',
      label: 'Top/Hat',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'mouthProbability',
      label: 'Mouth 0-100',
      type: 'probability',
      default: 100,
      description: 'Probability of showing mouth',
    },
    {
      name: 'sidesProbability',
      label: 'Sides 0-100',
      type: 'probability',
      default: 100,
      description: 'Probability of showing sides',
    },
    {
      name: 'textureProbability',
      label: 'Texture 0-100',
      type: 'probability',
      default: 50,
      description: 'Probability of showing texture',
    },
    {
      name: 'topProbability',
      label: 'Top 0-100',
      type: 'probability',
      default: 100,
      description: 'Probability of showing top',
    },
  ],
};

export const adventurerOptions: StyleConfiguration = {
  name: 'adventurer',
  options: [
    {
      name: 'eyebrows',
      label: 'Eyebrows',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'mouth',
      label: 'Mouth',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'hair',
      label: 'Hair',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'earrings',
      label: 'Earrings',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
    {
      name: 'glasses',
      label: 'Glasses Type',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'features',
      label: 'Face Features',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
    {
      name: 'earringsProbability',
      label: 'Earrings 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing earrings',
    },
    {
      name: 'glassesProbability',
      label: 'Glasses 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing glasses',
    },
    {
      name: 'featuresProbability',
      label: 'Features 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of showing face features',
    },
    {
      name: 'hairProbability',
      label: 'Hair 0-100',
      type: 'probability',
      default: 100,
      description: 'Probability of showing hair',
    },
  ],
};

export const notionistsOptions: StyleConfiguration = {
  name: 'notionists',
  options: [
    {
      name: 'body',
      label: 'Body',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'eyes',
      label: 'Eyes',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'brows',
      label: 'Eyebrows',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'nose',
      label: 'Nose',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
    {
      name: 'lips',
      label: 'Lips',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'hair',
      label: 'Hair',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'beard',
      label: 'Beard',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
    {
      name: 'glasses',
      label: 'Glasses Type',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
        { value: 'variant03', label: 'Style 3' },
      ],
    },
    {
      name: 'bodyIcon',
      label: 'Body Icon',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
    {
      name: 'gesture',
      label: 'Gesture',
      type: 'select',
      options: [
        { value: 'variant01', label: 'Style 1' },
        { value: 'variant02', label: 'Style 2' },
      ],
    },
    {
      name: 'beardProbability',
      label: 'Beard 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of showing beard',
    },
    {
      name: 'glassesProbability',
      label: 'Glasses 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of wearing glasses',
    },
    {
      name: 'bodyIconProbability',
      label: 'Body Icon 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of showing body icon',
    },
    {
      name: 'gestureProbability',
      label: 'Gesture 0-100',
      type: 'probability',
      default: 10,
      description: 'Probability of showing gesture',
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
