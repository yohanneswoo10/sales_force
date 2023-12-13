# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
import frappe
import frappe.utils
from frappe import _
from frappe.model.mapper import get_mapped_doc
from frappe.utils import add_days, cint, cstr, flt, get_link_to_form, getdate, nowdate, strip_html
from frappe.model.document import Document
from frappe.model.document import Document
from frappe.utils import cstr, encode
from cryptography.fernet import Fernet, InvalidToken
from passlib.hash import pbkdf2_sha256, mysql41
from passlib.registry import register_crypt_handler
from passlib.context import CryptContext
from pypika.terms import Values

from frappe import publish_progress
from frappe.core.doctype.file.file import create_new_folder
from frappe.utils.file_manager import save_file
from frappe.model.naming import _format_autoname
from frappe.utils import get_files_path

class TeamSell(Document):
    pass
	
class LegacyPassword(pbkdf2_sha256):
	name = "frappe_legacy"
	ident = "$frappel$"

	def _calc_checksum(self, secret):
		# check if this is a mysql hash
		# it is possible that we will generate a false positive if the users password happens to be 40 hex chars proceeded
		# by an * char, but this seems highly unlikely
		if not (secret[0] == "*" and len(secret) == 41 and all(c in string.hexdigits for c in secret[1:])):
			secret = mysql41.hash(secret + self.salt.decode('utf-8'))
		return super(LegacyPassword, self)._calc_checksum(secret)


register_crypt_handler(LegacyPassword, force=True)
passlibctx = CryptContext(
	schemes=[
		"pbkdf2_sha256",
		"argon2",
		"frappe_legacy",
	],
	deprecated=[
		"frappe_legacy",
	],
)

@frappe.whitelist()
def check_password(user, pwd, doctype='User', fieldname='password'):
	auth = frappe.db.sql("""select name, password from `__Auth` where doctype=%(doctype)s and name=%(name)s and fieldname=%(fieldname)s and encrypted=0""", {'doctype': doctype, 'name': user, 'fieldname': fieldname}, as_dict=True)
	if not auth or not passlibctx.verify(pwd, auth[0].password):
		frappe.msgprint("Incorrect User or Password", raise_exception=True)
	return user

@frappe.whitelist()
def attach_pdf(doctype, name, title):
	doctype_folder = create_folder(_(doctype), "Home")
	title_folder = create_folder(title, doctype_folder)
	#title_folder = "/home/banindoerp/frappe-bench/sites/erp.banindojayamas.com/private/pdf"
	pdf_data = get_pdf_data(doctype, name)
	filename = save_and_attach(pdf_data, doctype, name, title_folder)
	return get_file_path(filename)

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

def remove_file(file_url: str):
	fid = frappe.db.get_value("File", {"file_url": file_url})
	return fid

