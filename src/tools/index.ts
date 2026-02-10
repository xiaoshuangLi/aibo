import bash from './bash';
import utils from './utils';
import web from './web';
import puppeteerWeb from './puppeteer-web';

export default [
  ...bash,
  ...utils,
  ...puppeteerWeb,
];