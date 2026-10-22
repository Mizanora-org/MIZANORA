// Starter departments: shown on the home page (and offered in the admin category list) so the shop looks like a
// full market even while it has few products. Real categories from your products always come first.
import { slugify } from './format';

export const DEPARTMENTS = [
  ['Footwear', 'Shoes, boots, sandals and sneakers'],
  ['Men Fashion', 'Shirts, trousers, kurtas and jackets'],
  ['Women Fashion', 'Dresses, abayas, scarves and bags'],
  ['Kids and Toys', 'Kids clothes, toys and school items'],
  ['Mobile Accessories', 'Cases, chargers, earbuds and covers'],
  ['Electronics', 'Gadgets, speakers, smart watches'],
  ['Home and Kitchen', 'Kitchen tools, storage and home decor'],
  ['Beauty and Care', 'Skin care, perfume and grooming'],
  ['Sports and Outdoor', 'Fitness, camping and tactical gear'],
  ['Health and Wellness', 'Honey, oils and daily wellness'],
  ['Grocery', 'Dry fruits, spices and pantry items'],
  ['Automotive', 'Car and bike accessories'],
].map(([name, blurb]) => ({ name, blurb, slug: slugify(name) }));
