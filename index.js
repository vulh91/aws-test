const SellingPartnerAPI = require("my-amazon-sp-api");
const dotenv = require("dotenv")
const fs = require("fs");
const { captureRejectionSymbol } = require("events");

dotenv.config();

const Marketplace = {
  US: 'ATVPDKIKX0DER',
  CA: 'A2EUQ1WTGCTBG2'
};

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

const getInventory = (spApi, { location, sku }) => withLog(() => spApi.callAPI({
  api_path: `/externalFulfillment/inventory/2021-01-06/locations/${location.supplySourceId}/skus/${sku}`,
  method: 'GET',
  version: 'v0'
}))

const updateInventory = (spApi, { location, sku, quantity }) => withLog(() => spApi.callAPI({
  method: 'PUT',
  api_path: `/externalFulfillment/inventory/2021-01-06/locations/${location.supplySourceId}/skus/${sku}`,
  query: {
    quantity
  },
  headers: {
    'If-Match': '1',
    'If-Unmodified-Since': '1'
  },
  version: "v0",
  stringToSignSeparator: ''
}));


const spapi = new SellingPartnerAPI({
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
    use_sandbox: false,
    debug_log: true
  },
  refresh_token: process.env.REFRESH_TOKEN
});

const getOrders = async ({ lastUpdatedAfter }) => {
  console.log(`Get orders page`)
  const getOrdersResponse = await spapi.callAPI({
    endpoint: 'orders',
    operation: 'getOrders',
    query: {
      MarketplaceIds: [Marketplace.US],
      LastUpdatedAfter: lastUpdatedAfter
    }
  });

  console.log(`Get order line items`)
  for (const order of getOrdersResponse.Orders) {
    var getOrderItemsResponse = await getOrderLineItems({ orderId: order.AmazonOrderId });
    order.LineItems = getOrderItemsResponse.OrderItems;
  }

  console.log(getOrdersResponse);

  return getOrdersResponse;
};

const getOrderLineItems = ({ orderId }) => spapi.callAPI({
  endpoint: 'orders',
  operation: 'getOrderItems',
  path: {
    orderId
  }
});

const exportOrders = async (days = 7) => {
  var lastUpdatedAfter = new Date();
  lastUpdatedAfter.setDate(lastUpdatedAfter.getDate() - days);

  var getOrdersResponse = await getOrders({ lastUpdatedAfter });

  writeFile('data/fba_orders.json', getOrdersResponse);

  return getOrdersResponse;
}

const getInventorySummaries = async (nextToken = null) => {
  console.log(`Get inventory item summaries. next token: ${nextToken}.`)
  return await spapi.callAPI({
    endpoint: 'fbaInventory',
    operation: 'getInventorySummaries',
    query: {
      marketplaceIds: [Marketplace.US],
      granularityType: 'Marketplace',
      granularityId: Marketplace.US,
      nextToken
    }
  });
}

const exportInventorySummaries = async () => {
  const allInventoryItems = [];
  let nextToken = '';
  while (true) {
    const response = await getInventorySummaries(nextToken);

    allInventoryItems.push(response.inventorySummaries);
    nextToken = response.nextToken;

    if (!nextToken)
      break;
  }

  console.log(allInventoryItems);

  writeFile('data/fba_inventory_summaries.json', allInventoryItems);
}

const exportListingItems = async () => new Promise(async (resolve, reject) => {
  const { reportId } = createReportResponse = await spapi.callAPI({
    endpoint: 'reports',
    operation: 'createReport',
    body: {
      reportType: "GET_MERCHANT_LISTINGS_ALL_DATA",
      marketplaceIds: [
        Marketplace.US
      ]
    }
  });

  console.log(createReportResponse);

  const invervalId = setInterval(async () => {
    console.log(`Checking report result`);
    const { processingStatus, reportDocumentId } = getReportResponse = await spapi.callAPI({
      endpoint: 'reports',
      operation: 'getReport',
      path: {
        reportId
      }
    });

    console.log(getReportResponse);
    console.log(`processing status: ${processingStatus}`);

    switch (processingStatus.toLowerCase()) {
      case 'cancelled':
      case 'fatal': {
        clearInterval(invervalId);
        reject(`Report ${reportId} status: ${processingStatus}`);
        break;
      }
      case 'done': {
        console.log(`Report ${reportId} ready. Getting report data`);
        const { payload } = getReportDocumentResposne = await spapi.callAPI({
          endpoint: 'reports',
          operation: 'getReportDocument',
          path: {
            reportDocumentId
          }
        });

        console.log(getReportDocumentResposne);
        clearInterval(invervalId);
        resolve(payload);
        break;
      }
    }
  }, 1000 * 60);

  // writeFile('data/listings_all_data.json', listCatalogItemsResponse);
});

const writeFile = (path, data) => {
  fs.writeFile(path, JSON.stringify(data), 'utf8', (err) => {
    if (err) throw err;
  });
}

(async () => {
  // await api.refreshAccessToken();
  // console.log(`access token: ${api.access_token}`);

  // Get SupplySources
  // const result  = await getSupplySources();

  // Update inventory
  // const location = { supplySourceId: "43cd8cd4-a944-4fa8-a584-5e3b3efdb045", alias: "mock" }
  // const skus = [
  //   'efptestsku2',
  // ]
  // const quantity = 15;

  // for (const sku of skus) {
  //   // const result = await getInventory({ location, sku });
  //   const updateResult = await updateInventory({ location, sku, quantity })
  // }

  // await exportOrders(7);
  // await exportInventorySummaries();
  // const reportDocument = await exportListingItems();
  // console.log(reportDocument);
})();
