const {stringify}=require('./assets/contribution');
const fields=['id','entry_id','list_id','kind','address_as_printed','geocode_query','lat','lon','matched_address','geocode_status','precision','provider','geocoded_at','note'];
module.exports=class{data(){return {pagination:{data:'db.lists',size:1,alias:'list'},permalink:data=>data.list.hasAddresses?'/data/list-addresses/'+data.list.id+'.csv':false,eleventyExcludeFromCollections:true};}render({list}){return '﻿'+stringify(list.addresses,fields);}};
