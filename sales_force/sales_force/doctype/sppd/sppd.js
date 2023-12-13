// Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('SPPD', {
	refresh: function(frm) {
		frm.set_value("total_diberikan", cur_frm.doc.total);
    	frm.refresh_fields("total_diberikan");
	},
	
	onload : function(frm) {
		frm.set_value("total_diberikan", cur_frm.doc.total);
    	frm.refresh_fields("total_diberikan");
	},
	hotel: function(frm) {
		calculate_total(frm);
	},
	bbm: function(frm) {
		calculate_total(frm);
	},
	transportasi_lokal: function(frm) {
		calculate_total(frm);
	},
	tunjangan_luar_kota: function(frm) {
		calculate_total(frm);
	},
	tunjangan_penugasan_sementara: function(frm) {
		calculate_total(frm);
	},
	lain_lain: function(frm) {
		calculate_total(frm);
	},
	total_diberikan: function(frm) {
		calculate_realisasi(frm, cur_frm.doc.total_diberikan);
	},
	hotel_realisasi: function(frm) {
		calculate_realisasi(frm, cur_frm.doc.total_diberikan);
	},
	bbm_realisasi: function(frm) {
		calculate_realisasi(frm, cur_frm.doc.total_diberikan);
	},
	transport_lokal_realisasi: function(frm) {
		calculate_realisasi(frm, cur_frm.doc.total_diberikan);
	},
	tunjangan_realisasi: function(frm) {
		calculate_realisasi(frm, cur_frm.doc.total_diberikan);
	},
	tunjangan_sementara_realisasi: function(frm) {
		calculate_realisasi(frm, cur_frm.doc.total_diberikan);
	},
	lain_lain_realisasi: function(frm) {
		calculate_realisasi(frm, cur_frm.doc.total_diberikan);
	},
});

function calculate_total(frm)
{
	var total = cur_frm.doc.hotel + cur_frm.doc.bbm + cur_frm.doc.transportasi_lokal + cur_frm.doc.tunjangan_luar_kota + cur_frm.doc.tunjangan_penugasan_sementara + cur_frm.doc.lain_lain;
	frm.set_value("total", total);
    frm.refresh_fields("total");
	frm.set_value("total_diberikan", cur_frm.doc.total);
    frm.refresh_fields("total_diberikan");
}

function calculate_realisasi(frm, total_di_berikan)
{
	var total_realisasi = cur_frm.doc.hotel_realisasi + cur_frm.doc.bbm_realisasi + cur_frm.doc.transport_lokal_realisasi + cur_frm.doc.tunjangan_realisasi + cur_frm.doc.tunjangan_sementara_realisasi + cur_frm.doc.lain_lain_realisasi;
	var sisa = total_di_berikan - total_realisasi;
	frm.set_value("sisa_kekurangan", sisa);
    frm.refresh_fields("sisa_kekurangan");
	frm.set_value("total_realisasi", total_realisasi);
	frm.refresh_fields("total_realisasi");
}