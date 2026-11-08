import 'next-intl';
import arCommon from '../locales/ar/common.json';
import arInventory from '../locales/ar/inventory.json';
import arErrors from '../locales/ar/errors.json';

declare global {
  type Messages = {
    common: typeof arCommon;
    inventory: typeof arInventory;
    errors: typeof arErrors;
  };
}

declare module 'next-intl' {
  interface AppIntlMessages extends Messages {}
}
