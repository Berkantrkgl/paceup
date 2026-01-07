from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_aws import ChatBedrock
import uuid
import time
import concurrent.futures
import threading

from dotenv import load_dotenv

def summarize_with_timeout(messages, timeout_seconds=15):
    """
    Özetleme işlemini belirtilen süre içinde tamamlamaya çalışır.
    Timeout aşılırsa, ilk SystemMessage ve son mesajı döndürür.
    """
    first_message = messages[0]
    last_message = messages[-1]
    
    # Özetleme işlemi için thread
    def summarize_task():
        try:

            load_dotenv(".env", override=True)
            llm = ChatBedrock(
                model_id="amazon.nova-lite-v1:0",
                region="us-east-1",
                model_kwargs=dict(temperature=0.6),
                verbose=True
            )
            
            # Mesaj içeriklerini birleştir (ilk ve son hariç)
            conversation_content = "\n\n".join([
                f"{'Kullanıcı' if isinstance(msg, HumanMessage) else 'Asistan' if isinstance(msg, AIMessage) else 'Araç'}: {msg.content}"
                for msg in messages[1:-1]
            ])
            
            # Özet için prompt
            summary_prompt = f"""
            Aşağıda bir konuşmanın geçmiş kısmı verilmiştir. Bu konuşmayı özetleyerek tek bir mesaj haline getir.
            Konuşmayla ilgili önemli bilgileri, bağlamı ve sorulan ana soruları dahil et.
            
            Konuşma:
            {conversation_content}
            
            Lütfen yukarıdaki konuşmanın kısa ama kapsamlı bir özetini yaz. Bu özet, kullanıcının sorularını ve verilen cevapları içermeli,
            önemli arama sonuçları ve bulunmuş bilgileri içermelidir.
            """
            
            summary_response = llm.invoke(summary_prompt)
            return summary_response.content
        except Exception as e:
            print(f"Özetleme sırasında hata oluştu: {e}")
            return None

    # ThreadPoolExecutor ile timeout kontrolü
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(summarize_task)
        try:
            summary_content = future.result(timeout=timeout_seconds)
            if summary_content:
                summary_message = HumanMessage(
                    content=f"**Önceki Konuşma Özeti:** {summary_content}",
                    id=str(uuid.uuid4())
                )
                return [first_message, summary_message, last_message]
        except concurrent.futures.TimeoutError:
            print(f"Özetleme işlemi {timeout_seconds} saniye içinde tamamlanamadı. Mesajlar kırpılıyor.")
            return [first_message, last_message]
        except Exception as e:
            print(f"Beklenmeyen hata: {e}")
            return [first_message, last_message]

def summarize_message_field(messages, timeout_seconds=15):
    """
    Özetleme fonksiyonu: İlk SystemMessage'ı korur, diğer tüm mesajları özet bir AIMessage'a dönüştürür.
    Timeout aşılırsa, ilk SystemMessage ve son mesajı döndürür.
    """
    if not messages or len(messages) <= 2:
        return messages  # Mesaj yoksa veya sadece 1-2 mesaj varsa değişiklik yapma
    
    start_time = time.time()
    result = summarize_with_timeout(messages, timeout_seconds)
    end_time = time.time()
    
    print(f"Mesaj özetleme için geçen zaman: {end_time - start_time:.2f} saniye.")
    return result

