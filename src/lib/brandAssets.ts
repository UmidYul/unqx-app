import { ImageSourcePropType } from 'react-native';

export const APP_DISPLAY_NAME = 'UNQX';

const BRAND_LOGO_LIGHT = require('../../assets/brand/logo.png') as ImageSourcePropType;
const BRAND_LOGO_DARK = require('../../assets/brand/logo-dark.png') as ImageSourcePropType;

export function getBrandLogoSource(isDark: boolean): ImageSourcePropType {
    return isDark ? BRAND_LOGO_DARK : BRAND_LOGO_LIGHT;
}
