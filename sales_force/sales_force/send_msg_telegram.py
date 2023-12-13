#TO MAKE IT EUN PLS ADD THIS CODE IN
#/erpnext/erpnext/hooks.py
#IN 
# scheduler_events
# "cron": {
#         "* * * * *": [
#                   "erpnext.sales_team.send_msg_telegram.check_outstanding_invoice",
#                   "erpnext.sales_team.send_msg_telegram.get_telegram_update"
#         ]
# },
#Please change the message url to your own url

from __future__ import unicode_literals

import calendar
from datetime import timedelta

import frappe
import frappe.utils
import erpnext.sales_team
import time
import requests
import datetime as dt
from frappe import _
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import (format_time, get_link_to_form, get_url_to_report,
        global_date_format, now, now_datetime, validate_email_address, today, add_to_date)
from frappe.model.naming import append_number_if_name_exists
from frappe.model.document import Document
from erpnext.sales_team import attach_pdf
from frappe.modules import get_doc_path
from jinja2 import TemplateNotFound
from frappe.utils import cint, strip_html
from frappe.utils.pdf import get_pdf,cleanup
from PyPDF2 import PdfFileWriter, PdfFileReader
from frappe.core.doctype.file.file import create_new_folder
from frappe.utils.file_manager import save_file, remove_file, save_file_on_filesystem
from frappe.utils import get_files_path
from datetime import datetime
from datetime import timedelta  

import requests

class SendMsgTelegram(Document):
    def get_report_content(self):
        '''Returns file in for the report in given format'''
        report = frappe.get_doc('Report', self.report)

        self.filters = frappe.parse_json(self.filters) if self.filters else {}

        if self.report_type=='Report Builder' and self.data_modified_till:
            self.filters['modified'] = ('>', now_datetime() - timedelta(hours=self.data_modified_till))

        if self.report_type != 'Report Builder' and self.dynamic_date_filters_set():
            self.prepare_dynamic_filters()

        columns, data = report.get_data(limit=self.no_of_rows or 100, user = self.user,
            filters = self.filters, as_dict=True, ignore_prepared_report=True)

        # add serial numbers
        columns.insert(0, frappe._dict(fieldname='idx', label='', width='30px'))
        for i in range(len(data)):
            data[i]['idx'] = i+1

        if len(data)==0 and self.send_if_data:
            return None

        if self.format == 'HTML':
            #columns, data = make_links(columns, data)
            columns = update_field_types(columns)
            return self.get_html_table(columns, data)

        elif self.format == 'XLSX':
            report_data = frappe._dict()
            report_data['columns'] = columns
            report_data['result'] = data

            xlsx_data, column_widths = build_xlsx_data(columns, report_data, [], 1, ignore_visible_idx=True)
            xlsx_file = make_xlsx(xlsx_data, "Auto Email Report", column_widths=column_widths)
            return xlsx_file.getvalue()

        elif self.format == 'CSV':
            report_data = frappe._dict()
            report_data['columns'] = columns
            report_data['result'] = data

            xlsx_data, column_widths = build_xlsx_data(columns, report_data, [], 1, ignore_visible_idx=True)
            return to_csv(xlsx_data)

        else:
            frappe.throw(_('Invalid Output Format'))

    def get_content(self):
        columns, data = report.get_data(limit=self.no_of_rows or 100, user = self.user,
           filters = self.filters, as_dict=True, ignore_prepared_report=True)
        # add serial numbers
        columns.insert(0, frappe._dict(fieldname='idx', label='', width='30px'))
        for i in range(len(data)):
            data[i]['idx'] = i+1

        if len(data)==0 and self.send_if_data:
            return None

        #columns, data = make_links(columns, data)
        columns = update_field_types(columns)
        return self.get_html_table(columns, data)

    def get_html_table(self, columns=None, data=None):

        date_time = global_date_format(now()) + ' ' + format_time(now())
        report_doctype = frappe.db.get_value('Report', self.report, 'ref_doctype')

        return frappe.render_template('frappe/templates/emails/telegram_report.html', {
            'title': self.name,
            'description': self.description,
            'date_time': date_time,
            'columns': columns,
            'data': data,
            'report_url': get_url_to_report(self.report, self.report_type, report_doctype),
            'report_name': self.report,
            'edit_report_settings': get_link_to_form('Auto Email Report', self.name)
        })
    
    def get_file_name(self):
        return "{0}.{1}".format(self.report.replace(" ", "-").replace("/", "-"), self.format.lower())

def send_to_telegram():
    message = 'https://erp.banindojayamas.com'
    apiToken = '5384066021:AAGYk4WKNeuj7BU_PRXR5XxVsIw79fkG5WA'
    chatID = '-861780666'
    #apiURL = f'https://api.telegram.org/bot{apiToken}/sendMessage'
    apiURL = f'https://api.telegram.org/bot{apiToken}/sendDocument'
    date_time = global_date_format(now()) + ' ' + format_time(now())
    docname = "Stock Report Motor " + date_time
    new_report_telegram = frappe.get_doc({"doctype": "Report To Telegram", "naming_series": docname})
    new_report_telegram.insert()
    frappe.db.commit()
    new_doc_name = docname + "00001"
    url = stock_pdf("Stock Report Motor", new_doc_name, "Portrait")
    message = "{}{}".format(message,url)
    print(message)
    try:
        response = requests.post(apiURL, json={'chat_id': chatID, 'document': message})
        print(response.text)
    except Exception as e:
        print(e)

def get_telegram_update():
    key = '5384066021:AAGYk4WKNeuj7BU_PRXR5XxVsIw79fkG5WA'
    start_time = time.time()
    result = requests.get(f'https://api.telegram.org/bot{key}/getUpdates?timeout=1').json()
    l = len(result['result'])
    i = 0
    while i < l:
        message = result['result'][i]['message']['text']
        #print (message)
        if message == "/start":
            ids = result['result'][i]['message']['chat']['id']
            users = get_telegram_users(ids)
            if len(users) > 0:
                if str(ids) != str(users[0].chat_id):
                    print ("ids:" + str(ids) +", " + str(users[0].chat_id))
            else:
                fname = result['result'][i]['message']['chat']['first_name']
                lname = result['result'][i]['message']['chat']['last_name']
                if "username" in result['result'][i]['message']['chat']:
                    uname = result['result'][i]['message']['chat']['username']
                else:
                    uname = ""
                full_name = fname + " " + lname
                
                doc = frappe.new_doc("Telegram Setting")
                doc.nama = full_name
                doc.username = uname
                doc.bot_name = "@banindosales_bot"
                doc.api_token = key
                doc.chat_id = ids
                doc.owner = "yohanneswoo10@gmail.com"
                doc.insert()
                
                #new_telegram = frappe.get_doc({"doctype": "Telegram Setting", "nama": full_name, "username": uname, "bot_name": "@banindosales_bot", "api_token": key, "chat_id": ids})
                #new_telegram.insert()
                frappe.db.commit()
                message = "Terima Kasih kepada: " + full_name + " yang telah mendaftarkan telegram anda kepada kami. Id telegram anda telah kami input ke database kami. Tidak perlu untuk membalas pesan ini."
                send_text(key, ids, message)
                print ("ids:" + str(ids))
        i +=1

def overdue_invoice_motor():
    send_report_to_telegram("Overdue Invoice Motor Zebrianto", "Landscape")
    send_report_to_telegram("Overdue Invoice Motor Nafret", "Landscape")
    send_report_to_telegram("Overdue Invoice Motor Fajar", "Landscape")
    send_report_to_telegram_personal("Overdue Invoice Motor Zebrianto", "Landscape", "Zebrianto")
    send_report_to_telegram_personal("Overdue Invoice Motor Nafret", "Landscape", "Nafret Afrido")
    send_report_to_telegram_personal("Overdue Invoice Motor Fajar", "Landscape", "Fajar Gunawan")

def send_report_to_telegram_personal(report_name, orienta, nama):
    message = 'https://erp.banindojayamas.com'
    telegram_user = get_telegram_user(nama)
    apiToken = telegram_user[0].api_token
    chatID = telegram_user[0].chat_id
    apiURL = f'https://api.telegram.org/bot{apiToken}/sendDocument'
    date_time = global_date_format(now()) + ' ' + format_time(now())
    docname = report_name + date_time
    new_report_telegram = frappe.get_doc({"doctype": "Report To Telegram", "naming_series": docname})
    new_report_telegram.insert()
    frappe.db.commit()
    new_doc_name = docname + "00001"
    url = stock_pdf(report_name, new_doc_name, orienta)
    message = "{}{}".format(message,url)
    print(message)
    try:
        response = requests.post(apiURL, json={'chat_id': chatID, 'document': message})
        print(response.text)
    except Exception as e:
        print(e)

def send_report_to_telegram(report_name, orienta):
    message = 'https://erp.banindojayamas.com'
    telegram_user = get_telegram_user("Banindo Group")
    apiToken = telegram_user[0].api_token
    chatID = telegram_user[0].chat_id
    apiURL = f'https://api.telegram.org/bot{apiToken}/sendDocument'
    date_time = global_date_format(now()) + ' ' + format_time(now())
    docname = report_name + date_time
    new_report_telegram = frappe.get_doc({"doctype": "Report To Telegram", "naming_series": docname})
    new_report_telegram.insert()
    frappe.db.commit()
    new_doc_name = docname + "00001"
    url = stock_pdf(report_name, new_doc_name, orienta)
    message = "{}{}".format(message,url)
    print(message)
    try:
        response = requests.post(apiURL, json={'chat_id': chatID, 'document': message})
        print(response.text)
    except Exception as e:
        print(e)
    
def get_telegram_user(nama):
    result = frappe.db.get_list('Telegram Setting', filters={'nama': nama}, fields=['nama','api_token','chat_id'])
    return result
    #print(result[0].chat_id)
    #doc.as_dict()
    #for result in doc:
    #   print(result.nama)

def get_telegram_users(id):
    result = frappe.db.get_list('Telegram Setting', filters={'chat_id': id}, fields=['nama','api_token','chat_id'])
    return result
    
def check_outstanding_invoice():
    date_time = now()
    txt = date_time.split()
    t = txt[1].split(":")
    tms = t[2].split(".")
    tc = t[0] + "::" + t[1] + "::" + tms[0]
    time_now = datetime.strptime(tc, '%H::%M::%S').time()
    #print (datetime.now() - timedelta(seconds=60))
    
    result = get_outstanding_invoice()
    n30 = 0
    n14 = 0
    ca = 0
    n301 = 0
    n141 = 0
    ca1 = 0
    for r in result:
        #print("Posting Time :", r.posting_time)
        #print("Current Time is :", t)
        pt = convert_time(str(r.posting_time))
        
        pte = timedelta(minutes=2)
        pt_end = (dt.datetime.combine(dt.date(1,1,1),pt) + pte).time()
        #print("time now" + str(pt))
        #print("time end" + str(pt_end))
        #print(r.customer_name + "," + str(r.duration)+","+r.payment_terms_template)
        if r.payment_terms_template == "Cash":
            #ca +=1
            if r.duration >=0 and r.duration <2:
                if pt <= time_now and pt_end >= time_now:
                    #print(r.name)
                    m = "Invoice No: " + r.name + " Telah Jatuh Tempo."+"\n"+"Cust Name: "+ r.customer_name + "\n" + "Tanggal Invoice: " + str(r.posting_date) + "\n" + "Total Invoice: " + r.invoice_amount + "\n" + "Outstanding Amt: " + r.outstanding_amount + "\n" + "Sales Person: " + r.sales_person
                    send_reminder(m)
                    if r.sales_person == "Nafret":
                        rs = get_telegram_user("Nafret Afrido")
                        send_text(rs.api_token,rs.chat_id,m)
                    elif r.sales_person == "Zebrianto":
                        rs = get_telegram_user("Zebrianto")
                        send_text(rs.api_token,rs.chat_id,m)
                    elif r.sales_person == "Fajar Gunawan":
                        rs = get_telegram_user("Fajar Gunawan")
                        send_text(rs.api_token,rs.chat_id,m)
        elif r.payment_terms_template == "Net 14":
            #n14 +=1
            if r.duration >=14 and r.duration <15:
                if pt <= time_now and pt_end >= time_now:
                    #print(r.name)
                    m = "Invoice No: " + r.name + " Telah Jatuh Tempo."+"\n"+"Cust Name: "+ r.customer_name + "\n" + "Tanggal Invoice: " + str(r.posting_date) + "\n" + "Total Invoice: " + r.invoice_amount + "\n" + "Outstanding Amt: " + r.outstanding_amount + "\n" + "Sales Person: " + r.sales_person
                    send_reminder(m)
                    if r.sales_person == "Nafret":
                        rs = get_telegram_user("Nafret Afrido")
                        send_text(rs.api_token,rs.chat_id,m)
                    elif r.sales_person == "Zebrianto":
                        rs = get_telegram_user("Zebrianto")
                        send_text(rs.api_token,rs.chat_id,m)
                    elif r.sales_person == "Fajar Gunawan":
                        rs = get_telegram_user("Fajar Gunawan")
                        send_text(rs.api_token,rs.chat_id,m)
        elif r.payment_terms_template == "Net 30":
            #n30 += 1
            if r.duration >=30 and r.duration <31:
                #n301 +=1
                #print(r.customer_name + "," + str(r.duration)+","+r.payment_terms_template + "," + str(pt) + "," + str(pt_end) + "," + str(time_now))
                if pt <= time_now and pt_end >= time_now:
                    #print("INI")
                    m = "Invoice No: " + r.name + " Telah Jatuh Tempo."+"\n"+"Cust Name: "+ r.customer_name + "\n" + "Tanggal Invoice: " + str(r.posting_date) + "\n" + "Total Invoice: " + r.invoice_amount + "\n" + "Outstanding Amt: " + r.outstanding_amount + "\n" + "Sales Person: " + r.sales_person
                    send_reminder(m)
                    if r.sales_person == "Nafret":
                        rs = get_telegram_user("Nafret Afrido")
                        send_text(rs.api_token,rs.chat_id,m)
                    elif r.sales_person == "Zebrianto":
                        rs = get_telegram_user("Zebrianto")
                        send_text(rs.api_token,rs.chat_id,m)
                    elif r.sales_person == "Fajar Gunawan":
                        rs = get_telegram_user("Fajar Gunawan")
                        send_text(rs.api_token,rs.chat_id,m)
    #print("ca: " + str(ca) + ", net14: " + str(n14) + ", net30: " + str(n30) + ", n301: " + str(n301))

def convert_time(times):
    t = times.split(":")
    tms = t[2].split(".")
    tc = t[0] + "::" + t[1] + "::" + tms[0]
    time_result = datetime.strptime(tc, '%H::%M::%S').time()
    #print(time_result)
    return time_result
    
def send_reminder(message):
    telegram_user = get_telegram_user("Banindo Group")
    apiToken = telegram_user[0].api_token
    chatID = telegram_user[0].chat_id
    apiURL = f'https://api.telegram.org/bot{apiToken}/sendMessage'
    
    try:
        response = requests.post(apiURL, json={'chat_id': chatID, 'text': message})
        print(response.text)
    except Exception as e:
        print(e)
    
def send_text(apiToken, chatID, message):
    apiURL = f'https://api.telegram.org/bot{apiToken}/sendMessage'
    
    try:
        response = requests.post(apiURL, json={'chat_id': chatID, 'text': message})
        print(response.text)
    except Exception as e:
        print(e)

def get_employee_telegram():
    result = frappe.db.get_list('Telegram Setting', filters={'tipe': 'Employee'}, fields=['nama','api_token','chat_id'])
    return result

def get_outstanding_invoice():
    status = "Cancelled"
    cash = "Cash"
    net14 = "Net 14"
    net30 = "Net 30"
    result = frappe.db.sql("""
                SELECT 
                t1.name,
                t1.customer_name,
                t1.posting_date,
                t1.posting_time,
                t1.due_date,
                t1.payment_terms_template,
                concat("Rp ", format(t1.rounded_total, 0)) as "invoice_amount",
                concat("Rp ", format(t1.outstanding_amount,0)) as "outstanding_amount",
                datediff(curdate(),t1.posting_date) as "duration",
                (select max(c.posting_date) from `tabPayment Entry` as c join `tabPayment Entry Reference` as d on c.name = d.parent where d.reference_name = t1.name and c.party = t1.customer) as "last_payment_date",
                concat("Rp ", format((select sum(b.allocated_amount) from `tabPayment Entry Reference` as b where b.reference_name = t1.name),0)) as "total_paid",
                (select t2.sales_person from `tabSales Team` as t2 where t1.name = t2.parent) as "sales_person"
                FROM `tabSales Invoice` as t1 
                inner join `tabSales Invoice Item` as t3 on t1.name = t3.parent
                left join `tabCustomer` as t4 on t1.customer = t4.name
                where
                t1.outstanding_amount > 0 
                AND t1.status!=%s
                GROUP BY t1.name """, (status), as_dict=True)
    return result

def stock_pdf(name, to_name, orient):
    send_msg_telegram = frappe.get_doc('Report', name)
    
    #data = send_msg_telegram.get_report_content()
    data = get_datas(send_msg_telegram)
   

    if not data:
        frappe.msgprint(_('No Data'))
        return
    
    #orientation="Portrait"
    orientation = orient
    title_folder = create_folder("Report", "Home")
    
    filename = "{to_name}.pdf".format(to_name=to_name.replace(" ", "-"))
    filecontent = get_pdf(data, {"orientation": orientation})
    #save_file(filename, filecontent, folder=title_folder, is_private=0)
    furl = frappe.db.get_value("File", {"attached_to_name": to_name},["file_url"])
    #print(data)
    if furl:
        remove_fl(furl)
        #save_file_on_filesystem(filename, filecontent, content_type=None, is_private=0)
        save_file(filename, filecontent, "Report To Telegram", to_name, folder=title_folder, is_private=0)
    else:
        #save_file_on_filesystem(filename, filecontent, content_type=None, is_private=0)
        save_file(filename, filecontent, "Report To Telegram", to_name, folder=title_folder, is_private=0)
        
    #save_file_on_filesystem(filename, filecontent, content_type=None, is_private=0)
    url = frappe.db.get_value("File", {"attached_to_name": to_name},["file_url"])
    #print(url)
    return url

def get_datas(report):
    columns, data = report.get_data(limit=500,
         as_dict=True, ignore_prepared_report=True)
    columns = update_field_types(columns)
    return get_html_table(report, columns, data)

def get_html_table(report, columns=None, data=None):
    date_time = global_date_format(now()) + ' ' + format_time(now())
    report_doctype = frappe.db.get_value('Report', 'Stock Report Motor', 'ref_doctype')

    return frappe.render_template('frappe/templates/emails/telegram_report.html', {
        'title': report.name,
        'date_time': date_time,
        'columns': columns,
        'data': data,
        'report_url': get_url_to_report('Stock Report Motor', report.report_type, report_doctype),
        'report_name': 'Stock Report Motor'
        
    })

def make_links(columns, data):
    for row in data:
        doc_name = row.get('name')
        for col in columns:
            if not row.get(col.fieldname):
                continue
            if col.fieldtype == "Link":
                if col.options and col.options != "Currency":
                    row[col.fieldname] = get_link_to_form(col.options, row[col.fieldname])
            elif col.fieldtype == "Dynamic Link":
                if col.options and row.get(col.options):
                    row[col.fieldname] = get_link_to_form(row[col.options], row[col.fieldname])
            elif col.fieldtype == "Currency":
                doc = frappe.get_doc(col.parent, doc_name) if doc_name and col.parent else None
                # Pass the Document to get the currency based on docfield option
                row[col.fieldname] = frappe.format_value(row[col.fieldname], col, doc=doc)
    return columns, data

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

def create_folder(folder, parent):
    new_folder_name = "/".join([parent, folder])

    if not frappe.db.exists("File", new_folder_name):
        create_new_folder(folder, parent)

    return new_folder_name

def remove_fl(file_url: str) -> "Document":
    fid = frappe.db.get_value("File", {"file_url": file_url})

    return remove_file(fid=fid)

def update_field_types(columns):
    for col in columns:
        if col.fieldtype in  ("Link", "Dynamic Link", "Currency")  and col.options != "Currency":
            col.fieldtype = "Data"
            col.options = ""
    return columns
