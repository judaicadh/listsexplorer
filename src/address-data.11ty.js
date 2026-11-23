const {addressData}=require('../lib/addresses');
module.exports=class{data(){return {permalink:'/address-data.json',eleventyExcludeFromCollections:true};}render({db}){return JSON.stringify(addressData(db));}};
