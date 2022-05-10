const SellingPartnerAPI = require("my-amazon-sp-api");
const dotenv = require("dotenv")

dotenv.config();

const withLog = async (fn) => {
  try {
    const result = await fn();
    console.info(JSON.stringify(result));
    return result;
  } catch (error) {
    console.error(error);
  }
}

const getSupplySources = (spApi) => withLog(() => spApi.callAPI({
  api_path: '/supplySources/2020-07-01/supplySources',
  method: 'GET',
  body: {},
  version: "v0"
}));

const getInventory = (spApi, { location, sku}) => withLog(() => spApi.callAPI({
  api_path: `/externalFulfillment/inventory/2021-01-06/locations/${location.supplySourceId}/skus/${sku}`,
  method: 'GET',
  version: 'v0'
}))

const updateInventory = (spApi, { location, sku, quantity }) => withLog(() => spApi.callAPI({
  api_path: `/externalFulfillment/inventory/2021-01-06/locations/${location.supplySourceId}/skus/${sku}?quantity=${quantity}`,
  method: 'PUT',
  headers: {
    'If-Match': '1',
    'If-Unmodified-Since': '1'
  },
  version: "v0",
  stringToSignSeparator: ''
}));

// console.log(process.env);

const spApi = new SellingPartnerAPI({
  region: "na",
  credentials: {
    SELLING_PARTNER_APP_CLIENT_ID: process.env.SELLING_PARTNER_APP_CLIENT_ID,
    SELLING_PARTNER_APP_CLIENT_SECRET: process.env.SELLING_PARTNER_APP_CLIENT_SECRET,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SELLING_PARTNER_ROLE: process.env.AWS_SELLING_PARTNER_ROLE,
  },
  options: {
    only_grantless_operations: false,
    use_sandbox: true,
    debug_log: true
  },
  refresh_token: process.env.REFRESH_TOKEN
});

(async () => {
  // await api.refreshAccessToken();
  // console.log(`access token: ${api.access_token}`);

  // Get SupplySources
  // const result  = await getSupplySources(spApi);

  // Update inventory
  const location = { supplySourceId: "43cd8cd4-a944-4fa8-a584-5e3b3efdb045", alias: "mock" }
  const skus = [
    'efptestsku2',
  ]
  const quantity = 15;

  for (const sku of skus) {
    const result = await getInventory(spApi, { location, sku });
    // updateInventory(spApi, { location, sku, quantity })
  }
})();

