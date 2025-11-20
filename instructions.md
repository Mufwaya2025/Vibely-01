Use the following link to reference the PAYMENTS API: https://lenco-api.readme.io/v2.0/reference/get-started
You will change the locale to Zambia and the currency to ZMW.
The outcome is that we should be able to collect payments for each event organization through ticket sale.
The outcome is also that we should be able to collect subscription payments from event organizer.
E.g.
Accept Payments
Lenco provides a simple and convenient payment flow for web with the popup widget. It can be integrated in a few easy steps.

Step 1: Collect customer information
To begin, you need to pass information such as email, amount, reference, etc.
Here is the full list of parameters you can pass:

Param	Required?	Description
key	Yes	Your public key from Lenco
email	Yes	Email address of customer
reference	Yes	Unique case sensitive reference. Only -, ., _, and alphanumeric characters allowed
amount	Yes	Amount the customer is to pay. This can include decimals (i.e. 10.75)
currency	No	ISO 3-Letter Currency Code e.g. ZMW, USD
label	No	Text to show on the widget. This could be the name of the checkout form.
bearer	No	Decide who will bear the fee. Either merchant (you), or customer (your customer).
Note: This will only be used if not already set in your dashboard.
channels	No	An array of payment channels to control what is made available to the customer to make a payment with.
Available channels include: [card, mobile-money]
customer	No	This field holds the customer details
customer.firstName	No	The first name of the customer
customer.lastName	No	The last name of the customer
customer.phone	No	The phone number of the customer
billing	No	This field holds the customer's billing address
billing.streetAddress	No	The street address
billing.city	No	The city
billing.state	No	The state or province.
If a country does not have states or provinces, this can be left blank.

Note: For US states and Canada provinces, this should be the 2-letter code for the state / province. i.e. California should be CA.

You can find the list of US State and Canada Province codes here
billing.postalCode	No	The postal code
billing.country	No	2-letter code i.e. United states should be US.
You can find the list of country codes here
onSuccess	No	Javascript function that runs when payment is successful. This should ideally be a script that uses the verify endpoint to check the status of the payment.
onClose	No	Javascript function that is called if the customer closes the payment window instead of making a payment.
onConfirmationPending	No	Javascript function that is called if the customer closes the payment window before we verify their payment.

Step 2: Initiate the Payment
When you have all the details needed to initiate the payment, the next step is to pass them to Lenco to display the popup widget.

HTML

<script src="/payment.js"></script>

<script>
function getPaidWithLenco() {
	LencoPay.getPaid({
		key: 'YOUR_PUBLIC_KEY', // your Lenco public key
		reference: 'ref-' + Date.now(), // a unique reference you generated
		email: 'customer@email.com', // the customer's email address
		amount: 1000, // the amount the customer is to pay
		currency: "ZMW",
		channels: ["card", "mobile-money"],
		customer: {
			firstName: "John",
			lastName: "Doe",
			phone: "0971111111",
		},
		onSuccess: function (response) {
			//this happens after the payment is completed successfully
			const reference = response.reference;
			alert('Payment complete! Reference: ' + reference);
			// Make an AJAX call to your server with the reference to verify the payment
		},
		onClose: function () {
			alert('Payment was not completed, window closed.');
		},
		onConfirmationPending: function () {
			alert('Your purchase will be completed when the payment is confirmed');
		},
	});
}
</script>

The production widget is served from `/payment.js`, a local copy of Lenco’s inline loader (the contents of the original `inline.js`) linked by default.  
For the sandbox environment, set `LENCO_ENV=sandbox` (or override the widget URL) and use https://pay.sandbox.lenco.co/js/v1/inline.js as the source for the Lenco widget script.

Important Notes:

The key field takes your Lenco public key.
The amount field should not be converted to the lowest currency unit. Rather you can pass in a number with decimal places i.e. 10.75
It is ideal to generate a unique reference from your system for every payment to avoid duplicate attempts.
The onSuccess callback function is called when payment has been completed successfully. See the next section for how to handle the callback.
The onClose callback function is called if the user closes the widget without completing payment.
The onConfirmationPending callback function is called if the customer closes the payment window before we verify their payment.

Step 3: Handle the onSuccess callback method
The onSuccess callback function is fired when the payment is successful. This is where you include any action you want to perform when the payment is successful.

The recommended next step here is to verify the payment as detailed in step 4.

📘
Note
To verify the payment, you have to set up a route or page on your server that you pass the reference to. Then from your server, you call the verify endpoint to confirm the statis of the payment, and the response is returned to your frontend.

There are 2 ways you can call your server from the callback function

Make an AJAX request to the endpoint on your server that handles the payment verification
JavaScript

onSuccess: function(response){
	$.ajax({
		url: 'https://www.yoururl.com/verify_payment?reference=' + response.reference,
		method: 'get',
		success: function (response) {
			// the payment status is in response.data.status
		} 
	});
}
Redirect to the verification endpoint URL on your server.
JavaScript

onSuccess: function(response) {
	window.location = "https://www.yoururl.com/verify_payment.php?reference=" + response.reference;
}
// On the redirected page, you can call Lenco's API to verify the payment.
❗️
Warning
Never call the Lenco API directly from your frontend to avoid exposing your api secret key on the frontend. All requests to the Lenco API should be initiated from your server, and your frontend gets the response from your server.


Step 4: Verify the Payment
You do this by making a GET request to https://api.lenco.co/access/v2/collections/status/:reference from your server using your reference. You can find more information about this endpoint here.

cURL

# Sample Request

curl https://api.lenco.co/access/v2/collections/status/ref-1
-H "Authorization: Bearer API_SECRET_KEY"
-X GET
JSON

// Sample Response

{
  "status": true,
  "message": "",
  "data": {
    "id": "d7bd9ccb-0737-4e72-a387-d00454341f21",
    "initiatedAt": "2024-03-12T07:06:11.562Z",
    "completedAt": "2024-03-12T07:14:10.412Z",
    "amount": "10.00",
    "fee": "0.25",
    "bearer": "merchant",
    "currency": "ZMW",
    "reference": "ref-1",
    "lencoReference": "240720004",
    "type": "mobile-money",
    "status": "successful",
    "source": "api",
    "reasonForFailure": null,
    "settlementStatus": "settled",
    "settlement": {
      "id": "c04583d7-d026-4dfa-b8b5-e96f17f93bb8",
      "amountSettled": "9.75",
      "currency": "ZMW",
      "createdAt": "2024-03-12T07:14:10.439Z",
      "settledAt": "2024-03-12T07:14:10.496Z",
      "status": "settled",
      "type": "instant",
      "accountId": "68f11209-451f-4a15-bfcd-d916eb8b09f4"
    },
    "mobileMoneyDetails": {
      "country": "zm",
      "phone": "0977433571",
      "operator": "airtel",
      "accountName": "Beata Jean",
      "operatorTransactionId": "MP240312.0000.A00001"
    },
    "bankAccountDetails": null,
    "cardDetails": null
  }
}

Step 5: Handle webhook
When a payment is successful, Lenco sends a collection.successful webhook event to your webhook URL. You can learn more here.


Webhooks
Learn how to listen to events whenever certain actions occur on your integration.

What are webhooks?
Whenever certain actions occur on your Lenco account or API integration, we trigger events which your application can listen to. This is where webhooks come in. A webhook is a URL on your server where we send payloads for such events. For example, if you implement webhooks, once a transfer is successful, we will immediately notify your server with a transfer.successful event. Here is a list of events we can send to your webhook URL.

📘
NB: You may not be able to rely completely on webhooks to get notified. An example is if your server is experiencing a downtime and your hook endpoints are affected, some customers might still be transacting independently of that and the hook call triggered would fail because your server was unreachable.

In such cases we advise that developers set up a re-query service that goes to poll for the transaction status at regular intervals e.g. every 30 minutes using the /transfers/:id or /transfers/status/:reference endpoint, till a successful or failed response is returned.

To setup your webhook URL, kindly reach out to support@lenco.co

Here are some things to note when setting up a webhook URL:

If using .htaccess, remember to add the trailing / to the url you set.
Do a test post to your URL and ensure the script gets the post body.
Ensure your webhook URL is publicly available (localhost URLs cannot receive events)
Receiving an event
All you have to do to receive the event is to create an unauthenticated POST route on your application. The event object is sent as JSON in the request body.

Node
PHP

// Using Express
app.post("/my/webhook/url", function(req, res) {
    // Retrieve the request's body
    var event = req.body;
    // Do something with event
    res.send(200);
});
Verifying events
It is important to verify that events originate from Lenco to avoid delivering value based on a counterfeit event.
Valid events are raised with an header X-Lenco-Signature which is essentially a HMAC SHA512 signature of the event payload signed using your webhook_hash_key.
The webhook_hash_key is a SHA256 hash of your API token.

Node
PHP

var crypto = require('crypto');
var apiToken = process.env.API_TOKEN;
var webhookHashKey = crypto.createHash("sha256").update(apiToken).digest("hex");
// Using Express
app.post("/my/webhook/url", function(req, res) {
    //validate event
    var hash = crypto.createHmac('sha512', webhookHashKey).update(JSON.stringify(req.body)).digest('hex');
    if (hash === req.headers['x-lenco-signature']) {
        // Retrieve the request's body
        var event = req.body;
        // Do something with event  
    }
    res.send(200);
});
Responding to an event
You should respond to an event with a 200 OK. We consider this an acknowledgement by your application. If your application responds with any status outside of either 200, 201, or 202, we will consider it unacknowledged and thus, continue to send it every 30 minutes for 24 hours. You don't need to send a request body or some other parameter as it would be discarded - we only pay attention to the status code.

If your application is likely to start a long running task in response to the event, Lenco may timeout waiting for the response and would ultimately consider the event unacknowledged and queue to be raised later. You can mitigate duplicity by having your application respond immediately with a 200 before it goes on to perform the rest of the task.

Types of events
Here are the events we currently raise. We would add more to this list as we hook into more actions in the future.

Event	Description
transfer.successful	A transfer was successfully completed from any of the accounts linked to your API token
transfer.failed	A transfer you attempted from any of the accounts linked to your API token has failed
collection.successful	A collection you attempted was successfully completed
collection.failed	A collection you attempted has failed
collection.settled	Your account was credited for a collection
transaction.credit	An account linked to your API token was credited
transaction.debit	An account linked to your API token was debited
transfer.successful
transfer.failed
collection.successful
collection.failed
collection.settled
transaction.credit
transaction.debit

{
    "event": "transfer.successful",
    "data": {
        "id": string,
        "amount": string,
        "fee": string,
        "currency": string,
        "narration": string,
        "initiatedAt": date-time,
        "completedAt": date-time | null,
        "accountId": string,
        "creditAccount": {
            "id": string | null,
            "type": string,
            "accountName": string,
            "accountNumber": string | null,
            "bank": {
                "id": string,
                "name": string,
                "country": string
            } | null,
            "phone": string | null,
            "operator": string | null,
            "walletNumber": string | null,
            "tillNumber": string | null
        },
        "status": "pending" | "successful" | "failed",
        "reasonForFailure": string | null,
        "reference": string | null,
        "lencoReference": string,
        "extraData": {
            "nipSessionId": string | null,
        },
        "source": "banking-app" | "api"
    }
}


We must also be able to allow organizers to withdraw their sales money less the commissions they are paying to us.
