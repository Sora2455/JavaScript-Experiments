export function onBuyClicked() {
    if (typeof PaymentRequest !== "function") {
        runFallbackPaymentRequest();
    } else {
        runPaymentRequest();
    }
}

function runFallbackPaymentRequest() {
    // PaymentRequest API is not available. Forwarding to
    // legacy form based experience.
    location.href = "/checkout";
}

function runPaymentRequest() {
    // Supported payment methods
    const supportedInstruments = [{
        data: {
            supportedNetworks: [
                "visa", "mastercard"
            ]
        },
        supportedMethods: ["basic-card"]
    }] as PaymentMethodData[];

    // Checkout details
    const details = {
        displayItems: [{
            amount: { currency: "AUD", value: "65.00" },
            label: "Original donation amount"
        }, {
            amount: { currency: "AUD", value: "-10.00" },
            label: "Friends and family discount"
        }],
        total: {
            amount: { currency: "AUD", value : "55.00" },
            label: "Total due"
        }
    } as PaymentDetailsInit;

    // 1. Create a `PaymentRequest` instance
    const request = new PaymentRequest(supportedInstruments, details);

    // 2. Show the native UI with `.show()`
    request.show()
    // 3. Process the payment
    .then((result) => {
        // POST the payment information to the server
        return fetch("/pay", {
            body: JSON.stringify(result.toJSON()),
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            method: "POST"
        }).then((response) => {
                // 4. Display payment results
                if (response.status === 200) {
                // Payment successful
                return result.complete("success");
            } else {
                // Payment failure
                return result.complete("fail");
            }
        }, () => {
            return result.complete("fail");
        });
    }, (reason) => {
        console.log(reason);
    });
}
