#THIS CODE IS TO ATTACH PDF DOC IN THE SALES ORDER AND SALES INVOICE EVERYTIME IT CREATED
#THIS CODE IS BEING USE LATER TO SEND A DOCUMENT IN TELEGRAM AFTER SALES ORDER OR SALES INVOICE IS CREATED
import frappe

from frappe import _
from frappe import publish_progress
from frappe.core.doctype.file.file import create_new_folder
from frappe.utils.file_manager import save_file, remove_file
from frappe.model.naming import _format_autoname
from frappe.utils import get_files_path

@frappe.whitelist()
def attach_pdf(doctype, name, title):
	doctype_folder = create_folder(_(doctype), "Home")
	title_folder = create_folder(title, doctype_folder)
	
	furl = get_attachment(name)
	if furl:
		remove_fl(furl)
		pdf_data = get_pdf_data(doctype, name)
		filename = save_and_attach(pdf_data, doctype, name, title_folder)
	else:
		pdf_data = get_pdf_data(doctype, name)
		filename = save_and_attach(pdf_data, doctype, name, title_folder)
	
	return get_attachment(name)

def get_attachment(name):
	furl = frappe.db.get_value("File", {"attached_to_name": name},["file_url"])
	return furl

def create_folder(folder, parent):
	new_folder_name = "/".join([parent, folder])

	if not frappe.db.exists("File", new_folder_name):
		create_new_folder(folder, parent)

	return new_folder_name


def get_pdf_data(doctype, name):
	html = frappe.get_print(doctype, name)
	return frappe.utils.pdf.get_pdf(html)

def save_and_attach(content, to_doctype, to_name, folder):
	file_name = "{to_name}.pdf".format(to_name=to_name.replace("/", "-"))
	#file_name = "asd.pdf"
	save_file(file_name, content, to_doctype, to_name, folder=folder, is_private=0)
	return file_name

def get_file_path(file_name):
        """Returns file path from given file name"""
        if '../' in file_name:
                return

        f = frappe.db.sql("""select file_url from `tabFile`
                where name=%s or file_name=%s""", (file_name, file_name))
        if f:
                file_name = f[0][0]

        file_path = file_name

        if "/" not in file_path:
                file_path = "/files/" + file_path

        if file_path.startswith("/private/files/"):
                file_path = get_files_path(*file_path.split("/private/files/", 1)[1].split("/"), is_private=1)

        elif file_path.startswith("/files/"):
                file_path = get_files_path(*file_path.split("/files/", 1)[1].split("/"))

        else:
                frappe.throw(_("There is some problem with the file url: {0}").format(file_path))

        return file_path

def remove_fl(file_url: str) -> "Document":
	fid = frappe.db.get_value("File", {"file_url": file_url})
	
	return remove_file(fid=fid)
