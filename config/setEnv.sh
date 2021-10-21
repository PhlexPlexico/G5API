#/bin/bash

sed -i "s|\"port\": 3301,|\"port\": $PORT,|g" /Get5API/G5API/config/production.json
sed -i "s|\"hostname\": \"http://localhost\",|\"hostname\": \"$HOSTNAME\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"dbKey\": \"Database 16 Byte Key.\",|\"dbKey\": \"$DBKEY\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"steamAPIKey\": \"API Key For Steam Calls.\",|\"steamAPIKey\": \"$STEAMAPIKEY\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"sharedSecret\": \"a secure secret for session sigining.\",|\"sharedSecret\": \"$SHAREDSECRET\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"clientHome\": \"http://localhost:8080\",|\"clientHome\": \"$CLIENTHOME\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"apiURL\": \"http://localhost:8080/api/\",|\"apiURL\": \"$APIURL\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"user\": \"get5_user\",|\"user\": \"$SQLUSER\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"password\": \"\",|\"password\": \"$SQLPASSWORD\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"database\": \"get5\",|\"database\": \"$DATABASE\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"host\": \"127.0.0.1\",|\"host\": \"$SQLHOST\",|g" /Get5API/G5API/config/production.json
sed -i "s|\"port\": 3306,|\"port\": $SQLPORT,|g" /Get5API/G5API/config/production.json
sed -i "s|\"steam_ids\": \"admins,go,here\"|\"steam_ids\": \"$ADMINS\"|g" /Get5API/G5API/config/production.json
sed -i "s|\"steam_ids\": \"super_admins,go,here\"|\"steam_ids\": \"$SUPERADMINS\"|g" /Get5API/G5API/config/production.json
sed -i "s|requirepass MySecurePassword|requirepass $REDISPASSWORD|g" /etc/redis/redis.conf
sed -i "s|\"redisPass\": \"super_secure\"|\"redisPass\": \"$REDISPASSWORD\"|g" /Get5API/G5API/config/production.json
sed -i "s|\"uploadDemos\": false|\"uploadDemos\": $UPLOADDEMOS|g" /Get5API/G5API/config/production.json
