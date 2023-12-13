# Copyright (c) 2023, Yohannes and contributors
# For license information, please see license.txt

# import frappe
import frappe
import frappe.utils
from frappe import _
from frappe.model.mapper import get_mapped_doc
from frappe.utils import add_days, cint, cstr, flt, get_link_to_form, getdate, nowdate, strip_html
from frappe.model.document import Document

class BPPB(Document):
	pass

@frappe.whitelist()
def get_actual_qty(item_code):
    #tot_avail_qty = frappe.db.sql("select actual_qty,warehouse from `tabBin` where item_code = %s", (item_code))
    #return tot_avail_qty
    return frappe.db.sql("select actual_qty,warehouse from `tabBin` where item_code = %s", (item_code), as_dict=True)

@frappe.whitelist()
def get_actual_qty_by_warehouse(item_code,warehouse):
    #tot_avail_qty = frappe.db.sql("select actual_qty,warehouse from `tabBin` where item_code = %s", (item_code))
    #return tot_avail_qty
    return frappe.db.sql("select actual_qty from `tabBin` where item_code = %s and warehouse = %s", (item_code,warehouse), as_dict=True)

@frappe.whitelist()
def get_items_qty(warehouse, item_code, start_date, end_date, salesman):

     items = frappe.db.sql("select b.item_code as 'item_code', sum(b.qty) as 'order_qty' " +
     "from `tabSales Order` as a "+
     "inner join `tabSales Order Item` as b "+
     "on a.name = b.parent "+
     "inner join `tabSales Team` as c "+
     "on c.parent = a.name "+
     "where a.status <> 'Cancelled' "+
     "and a.transaction_date between %s and %s "+
     "and a.set_warehouse = %s "+
     "and b.item_code = %s "+
     "and c.sales_person = %s "+
     "group by b.item_code", (start_date, end_date, warehouse, item_code, salesman), as_dict=True)
     """
     items = frappe.db.sql("select b.item_code as 'item_code', sum(b.qty) as 'order_qty' " +
     "from `tabSales Order` as a "+
     "inner join `tabSales Order Item` as b "+
     "on a.name = b.parent "+
     "where a.status = 'Draft' "+
     "and a.set_warehouse = %s "+
     "and b.item_code = %s "+
     "group by b.item_code", (warehouse, item_code), as_dict=True)
     """
     return items


def get_requested_item_qty(sales_order):
        return frappe._dict(frappe.db.sql("""
                select sales_order_item, sum(qty)
                from `tabMaterial Request Item`
                where docstatus = 1
                        and sales_order = %s
                group by sales_order_item
        """, sales_order))

@frappe.whitelist()
def make_material_request(source_name, target_doc=None):
    #requested_item_qty = get_requested_item_qty(source_name)
    def update_item(source, target, source_parent):
        # qty is for packed items, because packed items don't have stock_qty field
        qty = source.get("qty")
        #target.project = source_parent.project
        #target.qty = qty - requested_item_qty.get(source.name, 0)
        target.qty = qty
        #target.stock_qty = flt(target.qty) * flt(target.conversion_factor)
        target.description = get_item_description(source.item_code)
        target.from_warehouse = source_parent.mobil
        target.warehouse = "ByPass - PBJM"

    def set_missing_values(source, target):
                #target.purpose = "Material Transfer"
        target.material_request_type = "Material Transfer"
        target.set_from_warehouse = "ByPass - PBJM"
        target.set_warehouse = source.mobil

    doc = get_mapped_doc("BPPB", source_name, {
        "BPPB": {
            "doctype": "Material Request",
            "validation": {
                "docstatus": ["=", 0]
            }
        },
        "Packed Item": {
            "doctype": "Material Request Item",
            "field_map": {
                "parent": "bppb",
                "uom": "stock_uom"
            },
            "postprocess": update_item
        },
        "BPPB Item": {
            "doctype": "Material Request Item",
            "field_map": {
                "name": "bppb_item",
                "parent": "bppb"
            },
            #"condition": lambda doc: not frappe.db.exists('Product Bundle', doc.item_code) and doc.qty > requested_item_qty.get(doc.name, 0),
            "postprocess": update_item
        }
    }, target_doc, set_missing_values)

    return doc

def get_item_description(item_code):
    return frappe.db.get_value('Item', item_code, 'description')

@frappe.whitelist()
def make_material_request_balik(source_name, target_doc=None):
    #requested_item_qty = get_requested_item_qty(source_name)
    def update_item_balik(source, target, source_parent):
        # qty is for packed items, because packed items don't have stock_qty field
        qty = source.get("quantity_sisa")
        target.qty = qty
        #target.stock_qty = flt(target.qty) * flt(target.conversion_factor)
        target.description = get_item_description(source.item_code)
        target.from_warehouse = source_parent.mobil
        target.warehouse = "ByPass - PBJM"

    def set_missing_values(source, target):
                #target.purpose = "Material Transfer"
        target.material_request_type = "Material Transfer"
        target.set_from_warehouse = source.mobil
        target.set_warehouse = "ByPass - PBJM"

    doc = get_mapped_doc("BPPB", source_name, {
        "BPPB": {
            "doctype": "Material Request",
            "validation": {
                "docstatus": ["=", 1]
            }
        },
        "Packed Item": {
            "doctype": "Material Request Item",
            "field_map": {
                "parent": "bppb",
                "uom": "stock_uom"
            },
            "postprocess": update_item_balik
        },
        "BPPB Item": {
            "doctype": "Material Request Item",
            "field_map": {
                "name": "bppb_item",
                "parent": "bppb"
            },
            #"condition": lambda doc: not frappe.db.exists('Product Bundle', doc.item_code) and doc.qty > requested_item_qty.get(doc.name, 0),
            "postprocess": update_item_balik
        }
    }, target_doc, set_missing_values)

    return doc

