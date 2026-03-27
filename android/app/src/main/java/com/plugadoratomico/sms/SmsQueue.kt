package com.plugadoratomico.sms

// Fila simples em memória para guardar SMS recebidos antes do app estar pronto
// Funciona como uma caixa de entrada temporária
object SmsQueue {
    data class SmsMessage(val body: String, val sender: String)

    private val queue = mutableListOf<SmsMessage>()

    fun add(body: String, sender: String) {
        // Guarda no máximo 50 mensagens para não consumir memória demais
        if (queue.size < 50) queue.add(SmsMessage(body, sender))
    }

    // Retorna todas as mensagens pendentes e limpa a fila
    fun drain(): List<SmsMessage> {
        val copy = queue.toList()
        queue.clear()
        return copy
    }
}
