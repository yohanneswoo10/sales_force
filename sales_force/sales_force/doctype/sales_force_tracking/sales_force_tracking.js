// Copyright (c) 2023, Yohannes and contributors
// For license information, please see license.txt

frappe.ui.form.on('Sales Force Tracking', {
	refresh: function(frm) {
		if(cur_frm.doc.check_in_date !== undefined)
                {
                        frm.set_df_property('check_in', 'hidden', 1);
                }
                if(cur_frm.doc.check_out_date !== undefined)
                {
                        frm.set_df_property('check_out', 'hidden', 1);
                }
	},
	onload: function(frm) {
		if(cur_frm.doc.check_in_date !== undefined)
		{
			frm.set_df_property('check_in', 'hidden', 1);
		}
		if(cur_frm.doc.check_out_date !== undefined)
		{
			frm.set_df_property('check_out', 'hidden', 1);
		}
	},
	after_save: function(frm) {
		if(cur_frm.doc.check_in_date !== undefined)
                {
                        frm.set_df_property('check_in', 'hidden', 1);
                }
                if(cur_frm.doc.check_out_date !== undefined)
                {
                        frm.set_df_property('check_out', 'hidden', 1);
                }
	},

	lead: function(frm) {
		var leads = frm.doc.lead;
		frappe.call({
			async: false,
			method: 'frappe.client.get_list',
			args: {
				'doctype': 'Customer',
				'filter': {'lead_name': leads, 'disabled': 0},
				'fieldname': ['name']
			},
			callback: function(r) {
				if(r.message) {
					for(var i =0; i<r.message.length;i++) {
						//console.log(r.message[i].name);
						frm.set_value("customer", r.message[i].name);
						frm.refresh_fields("customer");
					} 
				}
			}
		});
	},

	customer: function(frm) {
		//console.log(frm.doc.lead);
                var cus = frm.doc.customer;
                frappe.call({
                        async: false,
                        method: 'frappe.client.get_list',
                        args: {
                                'doctype': 'Lead',
                                'filters': {'name': frm.doc.from_lead, 'disabled': 0},
                                'fields': ['name','latitude','longitude']
                        },
                        callback: function(r) {
                                if(r.message) {
                                        for(var i =0; i<r.message.length;i++) {
                                                //console.log(r.message[i].latitude);
                                                frm.set_value("lead", r.message[i].name);
						frm.set_value("latitude_data", r.message[i].latitude);
						frm.set_value("longitude_data", r.message[i].longitude);
                                                frm.refresh_fields("lead");
						frm.refresh_fields("latitude_data");
						frm.refresh_fields("longitude_data");
                                        }
                                }
                        }
                });
        },

	check_in: function(frm) {
		var current = frappe.datetime.nowdate() + " " + frappe.datetime.now_time();
		var fullname = "";
		var longitude = "";
		var latitude = "";
		frm.set_value('check_in_date',current);
		frm.set_value('sales_person',frappe.full_name);
		/*frappe.call({
			async: false,
			method:"frappe.client.get_value",
			args:{
				"doctype":"User",
				"filters":{
					"email":frappe.session.user
				},
				"fieldname":["full_name"]
				},
				callback: function(userEmail){
					if(userEmail.message !== undefined){
						cur_frm.set_value("sales_person",userEmail.message.full_name);
						//cur_frm.refresh_fields("user_email");
					}
				}
		});*/
		if(navigator.geolocation){
        		navigator.geolocation.getCurrentPosition(onPositionRecieved,locationNotRecieved,{ enableHighAccuracy: true});
        	}
		function onPositionRecieved(position){
		        longitude= position.coords.longitude;
		        latitude= position.coords.latitude;
	        	cur_frm.set_value('longitude',longitude);
	        	cur_frm.set_value('latitude',latitude);
			cur_frm.refresh_fields('longitude');
			cur_frm.refresh_fields('latitude');
			cur_frm.save();
			cur_frm.refresh();
		}
		//cur_frm.set_value('longitude',longitude);
		//cur_frm.set_value('latitude',latitude);
		//cur_frm.refresh_fields('longitude');
		//cur_frm.refresh_fields('latitude');

		function locationNotRecieved(positionError){
			console.log(positionError);
	        }
		if(cur_frm.doc.check_in_date !== undefined)
        	{
            		frm.set_df_property('check_in', 'hidden', 1);
        	}
		cur_frm.refresh_fields('longitude');
                cur_frm.refresh_fields('latitude');
		
		frappe.call({
                        async: false,
                        method:"frappe.client.get_value",
                        args:{
                                "doctype":"User",
                                "filters":{
                                        "email":frappe.session.user
                                },
                                "fieldname":["full_name"]
                                },
                                callback: function(userEmail){
                                        if(userEmail.message !== undefined){
                                                cur_frm.set_value("sales_person",userEmail.message.full_name);
                                                //cur_frm.refresh_fields("user_email");
                                        }
                                }
                });
		//console.log(cur_frm.doc.latitude);
		//cur_frm.refresh();
	},

	check_out: function(frm) {
		var current = frappe.datetime.nowdate() + " " + frappe.datetime.now_time();
		frm.set_value('check_out_date',current);
		var entry_datetime = cur_frm.doc.check_in_date.split(" ")[1];
		var exit_datetime = cur_frm.doc.check_out_date.split(" ")[1];
		var splitEntryDatetime= entry_datetime.split(':');
		var splitExitDatetime= exit_datetime.split(':');
		var totalMinsOfEntry= splitEntryDatetime[0] * 60 + parseInt(splitEntryDatetime[1]) + splitEntryDatetime[0] / 60;
		var totalSecOfEntry = (((parseInt(splitEntryDatetime[0])*60) + parseInt(splitEntryDatetime[1])) *60) + parseInt(splitEntryDatetime[2]);
		var totalMinsOfExit= splitExitDatetime[0] * 60 + parseInt(splitExitDatetime[1]) + splitExitDatetime[0] / 60;
		var totalSecOfExit= (((parseInt(splitExitDatetime[0])*60) + parseInt(splitExitDatetime[1])) *60) + parseInt(splitExitDatetime[2]);
		var entry_date = new Date(cur_frm.doc.check_in_date.split(" ")[0]);
		var exit_date = new Date(cur_frm.doc.check_out_date.split(" ")[0]);
		var diffTime = Math.abs(exit_date - entry_date);
		var diffDays = Math.ceil(diffTime/ (1000 * 60 * 60 * 24));
		var duration = parseInt(((diffDays*(24*60)) +totalMinsOfExit) - totalMinsOfEntry);
		var duration1 = parseInt(((diffDays*(24*60*60)) +totalSecOfExit) - totalSecOfEntry);

		cur_frm.set_value("duration",duration1);
		cur_frm.refresh_fields("duration");
		cur_frm.save('Submit');
		if(cur_frm.doc.check_out_date !== undefined)
    		{
        		frm.set_df_property('check_out', 'hidden', 1);
    		}
	},

	show_location: function(frm) {
		var longitude= cur_frm.doc.longitude;
		var latitude= cur_frm.doc.latitude;
		//console.log(longitude);
		//console.log(latitude);
		var myWin = window.open("https://maps.google.com/?q=" + latitude + "," + longitude);
	},

});
