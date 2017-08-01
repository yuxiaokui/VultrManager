#coding:utf-8
import sys, requests, socket

class VultrManager():

    def __init__(self):
        self.api = {"API-KEY": "xxx"}

    def listServers(self):
        url = "https://api.vultr.com/v1/server/list"
        res = requests.get(url, headers = self.api)
        servers = res.json()
        return servers

    def getServersInfo(self):
        servers = self.listServers()
        for server in servers:
            serverId = server
            ip = servers[serverId]["main_ip"]
            server_state = servers[serverId]["server_state"]
            current_bandwidth_gb = servers[serverId]["current_bandwidth_gb"]
            default_password = servers[serverId]["default_password"]
            print "ServerId:" + serverId + "\t" + "state:" + server_state + "\t" + "IP:" + ip
            print "GB:" + str(current_bandwidth_gb) + "\t" + "passwd:" + default_password
    

    def destroyOne(self):
        serverId = raw_input("Please input serverId:")
        url = "https://api.vultr.com/v1/server/destroy"
        data = {"SUBID": serverId}
        res = requests.post(url, headers = self.api, data = data)
        if res.status_code == 200:
            print "destroyed"

    def createOne(self):
        url = "https://api.vultr.com/v1/server/create"
        argvs = {
            "DCID":25, #tokyo           https://api.vultr.com/v1/regions/list
            "OSID": 245, #fedora 26     https://api.vultr.com/v1/os/list
            "VPSPLANID":201 # 5$        https://api.vultr.com/v1/plans/list

            }
        res = requests.post(url, headers = self.api, data = argvs)
        print res.text
        if res.status_code == 200:
            print "created"

if __name__ == "__main__":
    def help():
        print "1. list all servers"
        print "2. create server"
        print "3. destroy  server"
        
    run = VultrManager()
    while True:
        help()
        case = raw_input("Please input case:")
        if case == "1":
            run.getServersInfo()
        if case == "2":
            run.createOne()
        if case == "3":
            run.destroyOne()
