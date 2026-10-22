# Modelos de mensagem do WhatsApp (Cloud API)

Crie no **WhatsApp Manager** (Meta Business Suite > Modelos de mensagem), com estes nomes exatos,
categoria **Utilidade** e idioma **Português (BR)**. O código (`WhatsAppService`) envia os parâmetros nesta ordem.

## pedido_recebido
Parâmetros: 1 nome, 2 serviço, 3 data, 4 início, 5 término, 6 dias de prazo, 7 link do agendamento

```
Olá {{1}}! ✨ Recebemos o seu pedido de agendamento para {{2}}. Data: {{3}}. Início: {{4}}, término previsto: {{5}}. Ele está em análise e, assim que for confirmado, você recebe uma nova mensagem por aqui. Se não houver resposta em até {{6}} dias, o pedido expira e o horário é liberado. Acompanhe ou cancele pelo seu link: {{7}} Obrigada!
```

## agendamento_confirmado
Parâmetros: 1 nome, 2 serviço, 3 data, 4 início, 5 término, 6 valor do sinal, 7 PIX copia e cola, 8 link do agendamento

```
Olá {{1}}! ✨ O seu agendamento para {{2}} está confirmado! Data: {{3}}. Início do atendimento: {{4}}, término previsto: {{5}}. Para garantir o horário, faça o sinal de {{6}} por PIX (copia e cola): {{7}} Para ver ou cancelar (com mais de 24 h de antecedência), use o seu link: {{8}} Com menos de 24 h, é só responder esta mensagem. Até breve!
```

## pedido_recusado
Parâmetros: 1 nome, 2 serviço, 3 data, 4 hora, 5 motivo

```
Olá {{1}}! Infelizmente não vou conseguir atender o seu pedido de {{2}} em {{3}} às {{4}}. Motivo: {{5}}. Se quiser, responda esta mensagem para combinarmos outro horário. 💕
```

## pedido_expirado
Parâmetros: 1 nome, 2 serviço, 3 data, 4 hora

```
Olá {{1}}! Não consegui confirmar a tempo o seu pedido de {{2}} para {{3}} às {{4}}, então ele expirou e o horário foi liberado. Desculpe pela demora! Se ainda quiser o atendimento, responda esta mensagem ou faça um novo pedido pelo site. 💕
```

## Variáveis no servidor (`/opt/lari/api/deploy/.env`)
`WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_ACCESS_TOKEN` (token permanente de um Usuário do Sistema, não o token temporário de 24 h).
