// Copyright (c) 2019, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

frappe.provide("erpnext");
cur_frm.email_field = "email_id";

erpnext.LeadForceController = class LeadForceController extends frappe.ui.form.Controller {
	setup () {
		this.frm.make_methods = {
			'Customer': this.make_customer,
			'Quotation': this.make_quotation,
			'Opportunity': this.make_opportunity
		};

		// For avoiding integration issues.
		this.frm.set_df_property('first_name', 'reqd', true);
	}

	onload () {
		this.frm.set_query("customer", function (doc, cdt, cdn) {
			return { query: "erpnext.controllers.queries.customer_query" }
		});

		this.frm.set_query("lead_owner", function (doc, cdt, cdn) {
			return { query: "frappe.core.doctype.user.user.user_query" }
		});
	}

	refresh () {
		var me = this;
		let doc = this.frm.doc;
		erpnext.toggle_naming_series();
		frappe.dynamic_link = {
			doc: doc,
			fieldname: 'name',
			doctype: 'Lead Force'
		};

		if (!this.frm.is_new() && doc.__onload && !doc.__onload.is_customer) {
			this.frm.add_custom_button(__("Customer"), this.make_customer, __("Create"));
			this.frm.add_custom_button(__("Opportunity"), function() {
				me.frm.trigger("make_opportunity");
			}, __("Create"));
			this.frm.add_custom_button(__("Quotation"), this.make_quotation, __("Create"));
			if (!doc.__onload.linked_prospects.length) {
				this.frm.add_custom_button(__("Prospect"), this.make_prospect, __("Create"));
				this.frm.add_custom_button(__('Add to Prospect'), this.add_lead_to_prospect, __('Action'));
			}
		}

		if (!this.frm.is_new()) {
			frappe.contacts.render_address_and_contact(this.frm);
		} else {
			frappe.contacts.clear_address_and_contact(this.frm);
		}

		this.show_notes();
		this.show_activities();
	}

	add_lead_to_prospect () {
		frappe.prompt([
			{
				fieldname: 'prospect',
				label: __('Prospect'),
				fieldtype: 'Link',
				options: 'Prospect',
				reqd: 1
			}
		],
		function(data) {
			frappe.call({
				method: 'sales_force.sales_force.doctype.lead_force.lead_force.add_lead_to_prospect',
				args: {
					'lead': cur_frm.doc.name,
					'prospect': data.prospect
				},
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
					}
				},
				freeze: true,
				freeze_message: __('Adding Lead to Prospect...')
			});
		}, __('Add Lead to Prospect'), __('Add'));
	}

	make_customer () {
		frappe.model.open_mapped_doc({
			method: "sales_force.sales_force.doctype.lead_force.lead_force.make_customer",
			frm: cur_frm
		})
	}

	make_quotation () {
		frappe.model.open_mapped_doc({
			method: "sales_force.sales_force.doctype.lead_force.lead_force.make_quotation",
			frm: cur_frm
		})
	}

	make_prospect () {
		frappe.model.with_doctype("Prospect", function() {
			let prospect = frappe.model.get_new_doc("Prospect");
			prospect.company_name = cur_frm.doc.company_name;
			prospect.no_of_employees = cur_frm.doc.no_of_employees;
			prospect.industry = cur_frm.doc.industry;
			prospect.market_segment = cur_frm.doc.market_segment;
			prospect.territory = cur_frm.doc.territory;
			prospect.fax = cur_frm.doc.fax;
			prospect.website = cur_frm.doc.website;
			prospect.prospect_owner = cur_frm.doc.lead_owner;
			prospect.notes = cur_frm.doc.notes;

			let leads_row = frappe.model.add_child(prospect, 'leads');
			leads_row.lead = cur_frm.doc.name;

			frappe.set_route("Form", "Prospect", prospect.name);
		});
	}

	company_name () {
		if (!this.frm.doc.lead_name) {
			this.frm.set_value("lead_name", this.frm.doc.company_name);
		}
	}

	show_notes() {
		if (this.frm.doc.docstatus == 1) return;

		const crm_notes = new erpnext.utils.CRMNotes({
			frm: this.frm,
			notes_wrapper: $(this.frm.fields_dict.notes_html.wrapper),
		});
		crm_notes.refresh();
	}

	show_activities() {
		if (this.frm.doc.docstatus == 1) return;

		const crm_activities = new erpnext.utils.CRMActivities({
			frm: this.frm,
			open_activities_wrapper: $(this.frm.fields_dict.open_activities_html.wrapper),
			all_activities_wrapper: $(this.frm.fields_dict.all_activities_html.wrapper),
			form_wrapper: $(this.frm.wrapper),
		});
		crm_activities.refresh();
	}
};


extend_cscript(cur_frm.cscript, new erpnext.LeadForceController({ frm: cur_frm }));

frappe.ui.form.on("Lead Force", {
	make_opportunity: async function(frm) {
		let existing_prospect = (await frappe.db.get_value("Prospect Lead",
			{
				"lead": frm.doc.name
			},
			"name", null, "Prospect"
		)).message.name;

		if (!existing_prospect) {
			var fields = [
				{
					"label": "Create Prospect",
					"fieldname": "create_prospect",
					"fieldtype": "Check",
					"default": 1
				},
				{
					"label": "Prospect Name",
					"fieldname": "prospect_name",
					"fieldtype": "Data",
					"default": frm.doc.company_name,
					"depends_on": "create_prospect"
				}
			];
		}
		let existing_contact = (await frappe.db.get_value("Contact",
			{
				"first_name": frm.doc.first_name || frm.doc.lead_name,
				"last_name": frm.doc.last_name
			},
			"name"
		)).message.name;

		if (!existing_contact) {
			fields.push(
				{
					"label": "Create Contact",
					"fieldname": "create_contact",
					"fieldtype": "Check",
					"default": "1"
				}
			);
		}

		if (fields) {
			var d = new frappe.ui.Dialog({
				title: __('Create Opportunity'),
				fields: fields,
				primary_action: function() {
					var data = d.get_values();
					frappe.call({
						method: 'create_prospect_and_contact',
						doc: frm.doc,
						args: {
							data: data,
						},
						freeze: true,
						callback: function(r) {
							if (!r.exc) {
								frappe.model.open_mapped_doc({
									method: "sales_force.sales_force.doctype.lead_force.lead_force.make_opportunity",
									frm: frm
								});
							}
							d.hide();
						}
					});
				},
				primary_action_label: __('Create')
			});
			d.show();
		} else {
			frappe.model.open_mapped_doc({
				method: "sales_force.sales_force.doctype.lead_force.lead_force.make_opportunity",
				frm: frm
			});
		}
	},
	
	refresh: function(frm) {
	    var script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY&callback=initMap';
        script.async = true;
        
        let map;
        let panorama;
        
        let povheading = parseInt(cur_frm.doc.heading);
        let povpitch = parseInt(cur_frm.doc.pitch);
        if(povheading === undefined)
        {
            //console.log("t");
            povheading = 270;
            povpitch = 10;
            frm.set_value('heading',povheading);
            frm.set_value('pitch',povpitch);
        }
        // Attach your callback function to the `window` object
        window.initMap = function() {
            var coordinates;
        if(cur_frm.doc.latitude!==undefined){
            coordinates = new google.maps.LatLng(cur_frm.doc.latitude, cur_frm.doc.longitude);
            
        }else{
            //coordinates = new google.maps.LatLng(-0.955090, 100.402344);
        }
        
        map = new google.maps.Map(document.getElementById("map"), {
            center: coordinates,
            zoom: 18,
        });
        panorama = new google.maps.StreetViewPanorama(
		    document.getElementById("pano"),{
		        position: coordinates,
              		pov: {
                		heading: povheading,
                		pitch: povpitch,
              		},
              		motionTracking: false,
            	});
        map.setStreetView(panorama);
        
        var measle = new google.maps.Marker({
            position: coordinates,
            map: map,
            icon: {
              url: "https://maps.gstatic.com/intl/en_us/mapfiles/markers2/measle.png",
              size: new google.maps.Size(7, 7),
              anchor: new google.maps.Point(3.8, 3.8)
            }
        });
        var marker = new google.maps.Marker({
            position: coordinates,
            draggable: true,
            animation: google.maps.Animation.DROP,
            map: map,
            icon: {
              url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              labelOrigin: new google.maps.Point(75, 32),
              size: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 32)
            },
            label: {
              text: cur_frm.doc.customer_name,
              color: "#C70E20",
              fontWeight: "bold"
            }
        });
        if(cur_frm.doc.latitude!==undefined){
            marker.setAnimation(google.maps.Animation.BOUNCE);
            
        }
        
        //marker.addListener("click", toggleBounce);
        function toggleBounce() {
          if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
          } else {
            marker.setAnimation(google.maps.Animation.BOUNCE);
          }
        }
        
        marker.addListener("dragend", dragged);
        function dragged(){
        //google.maps.event.addListener(marker, 'dragend', function() {
            var latlng = marker.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
            fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                if(street !== undefined)
                {
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                    
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                   
                }
            })
            .catch(err => console.log(err));
         
    //});
        }
        
        panorama.addListener("position_changed", () => {
            var latlng = panorama.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
	        fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                if(street !== undefined)
                {
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                    
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                   
                }
                marker.setPosition(latlng);
                map.panTo(latlng);
            })
            .catch(err => console.log(err));
        });
         // JS API is loaded and available
        };
	},
	
	after_save(frm) {
	    var script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY&callback=initMap';
        script.async = true;
        let povheading = parseInt(cur_frm.doc.heading);
        let povpitch = parseInt(cur_frm.doc.pitch);
        if(povheading === undefined)
        {
            console.log("t");
            povheading = 270;
            povpitch = 10;
            frm.set_value('heading',povheading);
            frm.set_value('pitch',povpitch);
        }
	    //console.log(povheading);
        let map;
        let panorama;
        // Attach your callback function to the `window` object
        window.initMap = function() {
            var coordinates;
        if(cur_frm.doc.latitude!==undefined){
            coordinates = new google.maps.LatLng(cur_frm.doc.latitude, cur_frm.doc.longitude);
            
        }else{
            //coordinates = new google.maps.LatLng(-0.955090, 100.402344);
        }
        //
        
        map = new google.maps.Map(document.getElementById("map"), {
            center: coordinates,
            zoom: 18,
        });
        panorama = new google.maps.StreetViewPanorama(
		    document.getElementById("pano"),{
		        position: coordinates,
              		pov: {
                		heading: povheading,
                		pitch: povpitch,
              		},
              		motionTracking: false,
            	});
        map.setStreetView(panorama);
        
        var measle = new google.maps.Marker({
            position: coordinates,
            map: map,
            icon: {
              url: "https://maps.gstatic.com/intl/en_us/mapfiles/markers2/measle.png",
              size: new google.maps.Size(7, 7),
              anchor: new google.maps.Point(3.8, 3.8)
            }
        });
        var marker = new google.maps.Marker({
            position: coordinates,
            draggable: true,
            animation: google.maps.Animation.DROP,
            map: map,
            icon: {
              url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              labelOrigin: new google.maps.Point(75, 32),
              size: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 32)
            },
            label: {
              text: cur_frm.doc.customer_name,
              color: "#C70E20",
              fontWeight: "bold"
            }
        });
        if(cur_frm.doc.latitude!==undefined){
            marker.setAnimation(google.maps.Animation.BOUNCE);
            
        }
        
        //marker.addListener("click", toggleBounce);
        function toggleBounce() {
          if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
          } else {
            marker.setAnimation(google.maps.Animation.BOUNCE);
          }
        }
        
        
        var latlng = marker.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
            fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                /*if(street !== undefined)
                {
                    frm.set_value('map_address',address);
                    get_address(frm,result);
                    console.log("0");
                    console.log(address);
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    frm.set_value('map_address',address);
                    get_address(frm,result);
                    console.log("1");
                    console.log(address);
                }*/
                
                //console.log("GEOMETRIC_CENTER" + data.results[0].address_components[0].long_name);
                //console.log("ROOFTOP" + data.results[1].formatted_address);
                
                
                
                
            })
            .catch(err => console.log(err));
        
        marker.addListener("dragend", dragged);
        function dragged(){
        //google.maps.event.addListener(marker, 'dragend', function() {
            var latlng = marker.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
            fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                /*if(street !== undefined)
                {
                    frm.set_value('map_address',address);
                    get_address(frm,result);
                    
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    frm.set_value('map_address',address);
                    get_address(frm,result);
                   
                }*/
            })
            .catch(err => console.log(err));
         
    //});
        }
        
        panorama.addListener("position_changed", () => {
            var latlng = panorama.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
	        
	        
	        fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                if(street !== undefined)
                {
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                    
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                   
                }
                marker.setPosition(latlng);
                map.panTo(latlng);
            })
            .catch(err => console.log(err));
        });
        
        panorama.addListener("pov_changed", () => {
            var povheading = panorama.getPov().heading + "";
            var povpitch = panorama.getPov().pitch + "";
            frm.set_value('heading',povheading);
            frm.set_value('pitch',povpitch);
        });
         // JS API is loaded and available
        };
        
        
        
        // Append the 'script' element to 'head'
        document.head.appendChild(script);
	}, //after_save
	
	onload(frm){
	    var script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY&callback=initMap';
        script.async = true;
        let povheading = parseInt(cur_frm.doc.heading);
        let povpitch = parseInt(cur_frm.doc.pitch);
        if(povheading === undefined)
        {
            console.log("t");
            povheading = 270;
            povpitch = 10;
            frm.set_value('heading',povheading);
            frm.set_value('pitch',povpitch);
        }
	    //console.log(povheading);
        let map;
        let panorama;
        // Attach your callback function to the `window` object
        window.initMap = function() {
            var coordinates;
        if(cur_frm.doc.latitude!==undefined){
            coordinates = new google.maps.LatLng(cur_frm.doc.latitude, cur_frm.doc.longitude);
            
        }else{
            //coordinates = new google.maps.LatLng(-0.955090, 100.402344);
        }
        //
        
        map = new google.maps.Map(document.getElementById("map"), {
            center: coordinates,
            zoom: 18,
        });
        panorama = new google.maps.StreetViewPanorama(
		    document.getElementById("pano"),{
		        position: coordinates,
              		pov: {
                		heading: povheading,
                		pitch: povpitch,
              		},
              		motionTracking: false,
            	});
        map.setStreetView(panorama);
        
        var measle = new google.maps.Marker({
            position: coordinates,
            map: map,
            icon: {
              url: "https://maps.gstatic.com/intl/en_us/mapfiles/markers2/measle.png",
              size: new google.maps.Size(7, 7),
              anchor: new google.maps.Point(3.8, 3.8)
            }
        });
        var marker = new google.maps.Marker({
            position: coordinates,
            draggable: true,
            animation: google.maps.Animation.DROP,
            map: map,
            icon: {
              url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              labelOrigin: new google.maps.Point(75, 32),
              size: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 32)
            },
            label: {
              text: cur_frm.doc.customer_name,
              color: "#C70E20",
              fontWeight: "bold"
            }
        });
        if(cur_frm.doc.latitude!==undefined){
            marker.setAnimation(google.maps.Animation.BOUNCE);
            
        }
        
        //marker.addListener("click", toggleBounce);
        function toggleBounce() {
          if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
          } else {
            marker.setAnimation(google.maps.Animation.BOUNCE);
          }
        }
        
        
        var latlng = marker.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
            fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                if(street !== undefined)
                {
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                    //console.log("0");
                    //console.log(address);
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                    //console.log("1");
                    //console.log(address);
                }
                
                //console.log("GEOMETRIC_CENTER" + data.results[0].address_components[0].long_name);
                //console.log("ROOFTOP" + data.results[1].formatted_address);
                
                
                
                
            })
            .catch(err => console.log(err));
        
        marker.addListener("dragend", dragged);
        function dragged(){
        //google.maps.event.addListener(marker, 'dragend', function() {
            var latlng = marker.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
            fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                if(street !== undefined)
                {
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                    
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                   
                }
            })
            .catch(err => console.log(err));
         
    //});
        }
        
        panorama.addListener("position_changed", () => {
            var latlng = panorama.getPosition();
            frm.set_value('longitude',latlng.lng());
	        frm.set_value('latitude',latlng.lat());
	        
	        
	        fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latlng.lat() + ',' + latlng.lng() + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	        .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                if(street !== undefined)
                {
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                    
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    /*frm.set_value('map_address',address);
                    get_address(frm,result);*/
                   
                }
                marker.setPosition(latlng);
                map.panTo(latlng);
            })
            .catch(err => console.log(err));
        });
        
        panorama.addListener("pov_changed", () => {
            var povheading = panorama.getPov().heading + "";
            var povpitch = panorama.getPov().pitch + "";
            frm.set_value('heading',povheading);
            frm.set_value('pitch',povpitch);
        });
         // JS API is loaded and available
        };
        
        
        
        // Append the 'script' element to 'head'
        document.head.appendChild(script);
        
	}//Onload
});


frappe.ui.form.on("Lead Force", "get_location", function(frm) {
    function onPositionRecieved(position){
	        var longitude= position.coords.longitude;
	        var latitude= position.coords.latitude;
	        frm.set_value('longitude',longitude);
	        frm.set_value('latitude',latitude);
	        //console.log(longitude);
	        //console.log(latitude);
	        
	        fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latitude + ',' + longitude + '&key=AIzaSyAkbvGIqwPrwvDT-gJJwqwlKelpjkwYzcY')
	         .then(response => response.json())
            .then(data => {
                var address = data.results[0].formatted_address;
                let result = data.results[0].address_components;
                let street;
                for (let i = 0; i < result.length; i++) {
                    let type_of_param = result[i].types[0];
                    let long_name = result[i].long_name;
                    if (type_of_param === "route") {
                        street = long_name;
                    } 
                }
                if(street !== undefined)
                {
                    frm.set_value('map_address',address);
                    get_address(frm,result);
                    
                }
                else
                {
                    address = data.results[1].formatted_address;
                    result = data.results[1].address_components;
                    //frm.set_value('map_address',address);
                    get_address(frm,result);
                   
                }
                get_address(frm,result);
            })
            .catch(err => console.log(err));
            
	        //frm.set_df_property('my_location','options','<div class="mapouter"><div class="gmap_canvas"><iframe width=100% height="300" id="gmap_canvas" src="https://maps.google.com/maps?q='+latitude+','+longitude+'&t=&z=17&ie=UTF8&iwloc=&output=embed" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"></iframe><a href="https://yt2.org/youtube-to-mp3-ALeKk00qEW0sxByTDSpzaRvl8WxdMAeMytQ1611842368056QMMlSYKLwAsWUsAfLipqwCA2ahUKEwiikKDe5L7uAhVFCuwKHUuFBoYQ8tMDegUAQCSAQCYAQCqAQdnd3Mtd2l6"></a><br><style>.mapouter{position:relative;text-align:right;height:300px;width:100%;}</style><style>.gmap_canvas {overflow:hidden;background:none!important;height:300px;width:100%;}</style></div></div>');
            //frm.refresh_field('my_location');
	    }
	    
	    function locationNotRecieved(positionError){
	        console.log(positionError);
	    }
    if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(onPositionRecieved,locationNotRecieved,{ enableHighAccuracy: true});
        //console.log("123");
	 }
});

frappe.ui.form.on("Lead Force", "show_location", function(frm) {
    console.log("test");
    var longitude= cur_frm.doc.longitude;
	var latitude= cur_frm.doc.latitude;
	console.log(longitude);
	console.log(latitude);
    var myWin = window.open("https://maps.google.com/?q=" + latitude + "," + longitude);
});

function get_address(frm,result)
{
    let street, street_no, kel, kec, city, state, neg, postal_code, area = "";
    for (let i = 0; i < result.length; i++) {
        let type_of_param = result[i].types[0];
        let long_name = result[i].long_name;
        if (type_of_param === "postal_code") {
            postal_code = long_name;
        } else if (type_of_param === "administrative_area_level_1") {
            state = long_name;
        } else if (type_of_param === "administrative_area_level_2") {
            city = long_name;
        } else if (type_of_param === "administrative_area_level_3") {
            kec = long_name;
        } else if (type_of_param === "administrative_area_level_4") {
            kel = long_name;
        } else if (type_of_param === "country") {
            neg = long_name;
        } else if (type_of_param === "route") {
            street = long_name;
        } else if (type_of_param === "street_number") {
            street_no = long_name;
        } else if (type_of_param === "neighborhood") {
            if (area === "") {
                area = long_name;
            } else {
                area += ", " + long_name;
            }
        } else if (result[i].types[1] === "sublocality") {
            if (area === "") {
                area = long_name;
            } else {
                area += ", " + long_name;
            }
        }
    }
    //console.log(street);
    street = street + " No. " + street_no;
    frm.set_value('street_name',street);
    frm.set_value('kelurahan',kel);
    frm.set_value('kecamatan',kec);
    frm.set_value('kab_kota',city);
    frm.set_value('provinsi',state);
    frm.set_value('negara',neg);
    frm.set_value('kode_post',postal_code);
}
