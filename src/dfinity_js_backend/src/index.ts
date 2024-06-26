import { query, update, text, Record, StableBTreeMap, Variant, Vec, None, Some, Ok, Err, ic, Principal, Opt, nat64, Duration, Result, bool, Canister } from "azle";
import {
    Ledger, binaryAddressFromAddress, binaryAddressFromPrincipal, hexAddressFromPrincipal
} from "azle/canisters/ledger";
import { hashCode } from "hashcode";
import { v4 as uuidv4 } from "uuid";

/**
 * This type represents a product that can be listed on a marketplace.
 * It contains basic properties that are needed to define a product.
 */
const DataItem = Record({
    id: text,
    title: text,
    description: text,
    price: nat64,
    seller: Principal,
    attachmentURL: text,
    dataFormat: text,
    status:text,
    quality:text,
    rating: nat64
});

const Purchaser = Record({
    id: text,
    owner: Principal,
    name:text,
    price:nat64,
    message:text,
    purchasedItem:Vec(text)
});

const PurchaserPayload = Record({
    name:text,
    price:nat64,
    message:text,
});


const DataItemPayload = Record({
    title: text,
    description: text,
    price: nat64,
    attachmentURL: text,
    dataFormat: text,
    status:text,
    quality:text,
    rating: nat64
});

const Message = Variant({
    NotFound: text,
    InvalidPayload: text,
    PaymentFailed: text,
    PaymentCompleted: text,
    AuthenticationFailed: text,
});


const DataItemsStorage = StableBTreeMap(0, text, DataItem);
const purchasersStorage = StableBTreeMap(1, text , Purchaser)



// Helper function that trims the input string and then checks the length
// The string is empty if true is returned, otherwise, string is a valid value
function isInvalidString(str: text): boolean {
    return str.trim().length == 0
}

 // Helper function to ensure the input id meets the format used for ids generated by uuid
function isValidUuid(id: string): boolean {
    const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
    return regexExp.test(id);
}


/**
 * Helper function to validate the DataItemPayload
 */
function validateDataItemPayload(payload: typeof DataItemPayload): Vec<string>{
    const errors: Vec<text> = [];

    if (isInvalidString(payload.description)){
        errors.push(`description='${payload.description}' cannot be empty.`)
    }
    if (isInvalidString(payload.quality)){
        errors.push(`quality='${payload.quality}' cannot be empty.`)
    }
    if (isInvalidString(payload.title)){
        errors.push(`title='${payload.title}' cannot be empty.`)
    }
    if (isInvalidString(payload.attachmentURL)){
        errors.push(`attachmentURL='${payload.attachmentURL}' cannot be empty.`)
    }
    if (payload.price == BigInt(0)){
        errors.push(`price='${payload.price}' must be greater than zero.`)
    }
    return errors;
  }
/**
 * Helper function to validate the PurchaserPayload
 */
function validatePurchaserPayload(payload: typeof PurchaserPayload): Vec<string>{
    const errors: Vec<text> = [];

    if (isInvalidString(payload.name)){
        errors.push(`name='${payload.name}' cannot be empty.`)
    }
    if (isInvalidString(payload.message)){
        errors.push(`message='${payload.message}' cannot be empty.`)
    }
    if (payload.price == BigInt(0)){
        errors.push(`price='${payload.price}' must be greater than zero.`)
    }
    return errors;
  }

/* 
    initialization of the Ledger canister. The principal text value is hardcoded because 
    we set it in the `dfx.json`
*/
const icpCanister = Ledger(Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"));

export default Canister({

    getDataItems : query([], Vec(DataItem),  () => {
        return  DataItemsStorage.values();
    }
    ),

    getPurchasers : query([], Vec(Purchaser),  () => {
        return  purchasersStorage.values();
    }
    ),

    getDataItem: query([text], Result(DataItem, text), (id) => {
        if(!isValidUuid(id)){
            return Err(`Id="${id}" is not in the valid uuid format.`)
        }
        const dataOpt = DataItemsStorage.get(id);
        if ("None" in dataOpt) {
            return Err("Data Item not found");
        }
        return Ok(dataOpt.Some);
    } 
    ),

    getPurchaser: query([text], Result(Purchaser, text), (id) => {
        if(!isValidUuid(id)){
            return Err(`Id="${id}" is not in the valid uuid format.`)
        }
        const purchaserOpt = purchasersStorage.get(id);
        if ("None" in purchaserOpt) {
            return Err("Purchaser not found");
        }
        return Ok(purchaserOpt.Some);
    } 
    ),


    
    addDataItem: update([DataItemPayload], Result(DataItem, Message), (payload) => {
        if (typeof payload !== "object" || Object.keys(payload).length === 0) {
            return Err({ NotFound: "invalid payload" })
        }
        const validatePayloadErrors = validateDataItemPayload(payload);
        if (validatePayloadErrors.length){
            return Err({InvalidPayload: `Invalid payload. Errors=[${validatePayloadErrors}]`});
        }
        const data = { id: uuidv4(), seller: ic.caller(), ...payload };
        DataItemsStorage.insert(data.id, data);
        return Ok(data);
    }

    ),

    addPurchaser: update([PurchaserPayload], Result(Purchaser, Message), (payload) => {
        if (typeof payload !== "object" || Object.keys(payload).length === 0) {
            return Err({ NotFound: "invalid payoad" })
        }
        const validatePayloadErrors = validatePurchaserPayload(payload);
        if (validatePayloadErrors.length){
            return Err({InvalidPayload: `Invalid payload. Errors=[${validatePayloadErrors}]`});
        }
        const purchaser = { id: uuidv4(), owner: ic.caller(),...payload , purchasedItem:[]};
        purchasersStorage.insert(purchaser.id, purchaser);
        return Ok(purchaser);
    }

    ),

    updateDataItem: update([text, DataItemPayload], Result(DataItem, Message), (id, payload) => {
        if (typeof payload !== "object" || Object.keys(payload).length === 0) {
            return Err({ NotFound: "invalid payoad" })
        }
        if(!isValidUuid(id)){
            return Err({InvalidPayload :`Id="${id}" is not in the valid uuid format.`})
        }
        const validatePayloadErrors = validateDataItemPayload(payload);
        if (validatePayloadErrors.length){
            return Err({InvalidPayload: `Invalid payload. Errors=[${validatePayloadErrors}]`});
        }
        const dataOpt = DataItemsStorage.get(id);
        if ("None" in dataOpt) {
            return Err({ NotFound: "Data not found" });
        }
        const data = dataOpt.Some;
        if(data.seller.toString() !== ic.caller().toString()){
            return Err({AuthenticationFailed:`Caller is not the seller of the item.`})
        }
        const updatedData = { ...data, ...payload };
        DataItemsStorage.insert(id, updatedData);
        return Ok(updatedData);
    }),

    updatePurchaser: update([text, PurchaserPayload], Result(Purchaser, Message), (id, payload) => {
        if (typeof payload !== "object" || Object.keys(payload).length === 0) {
            return Err({ NotFound: "invalid payoad" })
        }
        if(!isValidUuid(id)){
            return Err({InvalidPayload :`Id="${id}" is not in the valid uuid format.`})
        }
        const validatePayloadErrors = validatePurchaserPayload(payload);
        if (validatePayloadErrors.length){
            return Err({InvalidPayload: `Invalid payload. Errors=[${validatePayloadErrors}]`});
        }
        const purchaserOpt = purchasersStorage.get(id);
        if ("None" in purchaserOpt) {
            return Err({ NotFound: "Purchaser not found" });
        }
        const purchaser = purchaserOpt.Some;
        if(purchaser.owner.toString() !== ic.caller().toString()){
            return Err({AuthenticationFailed:`Caller is not the purchaser.`})
        }
        const updatedPurchaser = { ...purchaser, ...payload };
        purchasersStorage.insert(id, updatedPurchaser);
        return Ok(updatedPurchaser);
    }),


    deleteDataItem: update([text], Result(text, Message), (id) => {
        if(!isValidUuid(id)){
            return Err({InvalidPayload :`Id="${id}" is not in the valid uuid format.`})
        }
        const dataItemOpt = DataItemsStorage.get(id);
        if ("None" in dataItemOpt) {
            return Err({ NotFound: `cannot delete the DataItem: DataItem with id=${id} not found` });
        }
        if(dataItemOpt.Some.seller.toString() !== ic.caller().toString()){
            return Err({AuthenticationFailed:`Caller is not the seller of the item.`})
        }
        DataItemsStorage.remove(id);
        return Ok(dataItemOpt.Some.id);
    }),

    deletePurchaser: update([text], Result(text, Message), (id) => {
        if(!isValidUuid(id)){
            return Err({InvalidPayload :`Id="${id}" is not in the valid uuid format.`})
        }
        const purchaserOpt = purchasersStorage.get(id);
        if ("None" in purchaserOpt) {
            return Err({ NotFound: `cannot delete the Purchaser: Purchaser with id=${id} not found` });
        }
        if(purchaserOpt.Some.owner.toString() !== ic.caller().toString()){
            return Err({AuthenticationFailed:`Caller is not the purchaser.`})
        }
        purchasersStorage.remove(id);
        return Ok(purchaserOpt.Some.id);
    }),

    addPurchasedItem: update([text,text], Result(text, Message), (purchaserId,itemId) => {
        if(!isValidUuid(purchaserId)){
            return Err({InvalidPayload :`purchaserId="${purchaserId}" is not in the valid uuid format.`})
        }
        if(!isValidUuid(itemId)){
            return Err({InvalidPayload :`itemId="${itemId}" is not in the valid uuid format.`})
        }
        const purchaserOpt = purchasersStorage.get(purchaserId);
        if ("None" in purchaserOpt) {
            return Err({ NotFound: "Purchaser not found" });
        }
        const purchaser = purchaserOpt.Some;
        if(purchaser.owner.toString() !== ic.caller().toString()){
            return Err({AuthenticationFailed:`Caller is not the purchaser.`})
        }
        purchaser.purchasedItem.push(itemId);
        purchasersStorage.insert(purchaserId, purchaser);
        return Ok("Item added to Purchaser");
    } 

    ),

    searchDataItem: query([text], Vec(DataItem), (query) => {
        const datas = DataItemsStorage.values();
        return datas.filter(datum => datum.title.toLowerCase().includes(query.toLowerCase()) || datum.description.toLowerCase().includes(query.toLowerCase()));
    }),

    // filter by data format
    filterDataItem: query([text], Vec(DataItem), (query) => {
        const datas = DataItemsStorage.values();
        return datas.filter(datum => datum.dataFormat.toLowerCase().includes(query.toLowerCase()));
    }),

    getInitialDataItem: query([], Vec(DataItem), () => {
        const datas = DataItemsStorage.values();
        return datas.slice(0, 2);
    }
    ),

     // Load More Data Items
    getMoreDataItems: query([nat64,nat64], Vec(DataItem), (start, limit) => {
        const datas = DataItemsStorage.values();
        return datas.slice(Number(start),Number(start + limit));
    }),


});



// a workaround to make uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    }
};


