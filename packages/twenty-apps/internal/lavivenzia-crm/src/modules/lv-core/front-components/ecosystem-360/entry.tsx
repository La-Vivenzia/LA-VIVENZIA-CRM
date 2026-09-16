import { Listing360 } from 'src/modules/lv-core/front-components/ecosystem-360/listing-360';

// Named entry points for the two listing kinds (the wrappers must reference a
// component symbol, not an inline element).
export const Experience360 = () => <Listing360 kind="experience" />;
export const Property360 = () => <Listing360 kind="property" />;
